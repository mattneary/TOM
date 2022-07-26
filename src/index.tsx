import React from 'react'
import _ from 'lodash'
import Jerry, * as jerry from 'jerrymander'
import './main.scss'

function offsetZip(xs: string[]): [number, string][] {
  let offset = 0
  let chunks = []
  xs.forEach(x => {
    chunks.push([offset, x])
    offset += x.length
  })
  return chunks
}

class Address {
  basis: Content
  start: number
  end: number
  constructor(basis, start, end) {
    this.basis = basis
    this.start = start
    this.end = end
  }

  toJerry(root): jerry.Address {
    return new jerry.Address(root, this.start, this.end)
  }
}

class SplitString {
  strs: string[]
  length: number
  constructor(strs: string[]) {
    this.strs = strs
    this.length = _.sumBy(strs, 'length')
  }

  deleteRange(start: number, end: number): SplitString {
    const pairs = offsetZip(this.strs)
    const startPair = _.findLast(pairs, ([offset]) => offset <= start)
    const endPair = _.findLast(pairs, ([offset]) => offset < end)
    const startIdx = pairs.indexOf(startPair)
    const endIdx = pairs.indexOf(endPair)
    const [startOffset, startStr] = startPair
    const [endOffset, endStr] = endPair
    if (startIdx === endIdx) {
      return new SplitString([
        ...this.strs.slice(0, startIdx),
        startStr.substr(0, start - startOffset) + endStr.substr(end - startOffset),
        ...this.strs.slice(endIdx + 1),
      ])
    }
    return new SplitString([
      ...this.strs.slice(0, startIdx),
      startStr.substr(0, start - startOffset),
      endStr.substr(end - endOffset),
      ...this.strs.slice(endIdx + 1),
    ])
  }
}

type Link = {origin: Address, dest: Address}
type Content = {blocks: SplitString, links: Link[]}

function contentToStrings(content: Content): SplitString {
  return content.blocks
}

function contentToHtml(content: Content): Element {
  const article = document.createElement('article')
  content.blocks.strs.forEach(content => {
    const p = document.createElement('p')
    p.appendChild(document.createTextNode(content))
    article.appendChild(p)
  })
  article.setAttribute('contentEditable', 'true')
  return article
}

function mergeElms(a: Element, b: Element) {
  Array.from(b.childNodes).forEach(child => a.appendChild(child))
  b.parentNode.removeChild(b)
}

export class TOM {
  root: Element
  content: Content

  constructor(content: Content | string, node: Element = null) {
    this.root = node
    this.content = _.isString(content)
      ? { blocks: new SplitString(content.split('\n\n')), links: [] }
      : content
  }

  render(node: Element) {
    this.root = node
    this.root.appendChild(contentToHtml(this.content))
  }

  deleteSelection(): TOM {
    const article = this.root.querySelector('article')
    const sel = new Jerry(article).getSelection()
    if (sel.start === sel.end) {
      // TODO: implement normal backspace
      return this
    }
    const atoms = sel.toAtoms()
    const first: jerry.Address = atoms[0]
    const last: jerry.Address = _.last(atoms)
    const parents = _.map(atoms, 'root.parentNode')
    const firstParent = first.root.parentNode
    const lastParent = last.root.parentNode
    atoms.forEach(atom => atom.root.parentNode.removeChild(atom.root))
    parents.forEach(p => p.childNodes.length === 0 && p.parentNode.removeChild(p))
    if (atoms.length > 1) {
      if (firstParent !== lastParent) {
        if (firstParent.parentNode === lastParent.parentNode) {
          mergeElms(firstParent, lastParent)
        }
      }
    }

    window.getSelection().empty()
    const contentLength = contentToStrings(this.content).length
    const newModel = new TOM({
      blocks: this.content.blocks.deleteRange(sel.start, sel.end),
      links: [],
    }, this.root)
    newModel.content.links = _.compact([
      sel.start && {
        origin: new Address(newModel.content, 0, sel.start),
        dest: new Address(this.content, 0, sel.start),
      },
      sel.end !== contentLength && {
        origin: new Address(newModel.content, sel.start, contentLength - (sel.end - sel.start)),
        dest: new Address(this.content, sel.end, contentLength),
      },
    ])
    return newModel
  }
}

export function Tom({model, title = '', links = [], onChange = null, immutable = false}) {
  if (immutable) {
    return (
      <div
        className='page'
        ref={ref => {
          if (ref && !ref.querySelector('article')) {
            model.render(ref)
            const article = ref.querySelector('article')
            links.forEach(x => x.toJerry(article).highlight())
          }
        }}
      >
        <header>
          <h1>{title || <>&nbsp;</>}</h1>
        </header>
      </div>
    )
  }
  return (
    <div
      className='page'
      ref={ref => {
        if (ref && !ref.querySelector('article')) {
          model.render(ref)
          const article = ref.querySelector('article')
          article.addEventListener('paste', evt => {
            const data = evt.clipboardData.getData('jerry')
            console.log('data', data)
            // TODO: implement paste
            evt.preventDefault()
          })
          article.addEventListener('copy', evt => {
            const article = ref.querySelector('article')
            if (!article) return
            const sel = new Jerry(article).getSelection()
            evt.clipboardData.setData('text/plain', sel.getContent())
            evt.clipboardData.setData('jerry', [sel.start, sel.end].join('-'))
            evt.preventDefault()
          })
        }
      }}
      onKeyDown={evt => {
        if (evt.code === 'Backspace') {
          evt.preventDefault()
          const newModel = model.deleteSelection()
          onChange(newModel)
        }
      }}
    >
      <header>
        <h1>{title}</h1>
      </header>
    </div>
  )
}

export default function App({content}) {
  const [version, setVersion] = React.useState(0)
  const [model, setModel] = React.useState(new TOM(content))
  const basis = _.find(model.content.links, 'dest.basis')?.dest?.basis
  return (
    <div className='pages'>
      <Tom
        title="Current Version"
        model={model}
        onChange={m => {
          setModel(m)
          setVersion(x => x + 1)
        }}
      />
      {basis && <Tom
        key={version}
        model={new TOM(basis)}
        links={_.map(model.content.links, 'dest')}
        immutable
      />}
    </div>
  )
}
