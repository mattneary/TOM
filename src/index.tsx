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

type Direction = 'left' | 'right'
class SplitString {
  strs: string[]
  length: number
  constructor(strs: string[]) {
    this.strs = strs
    this.length = _.sumBy(strs, 'length')
  }

  getPair(strIndex: number, bias: Direction = 'left'): [number, string] {
    const pairs = offsetZip(this.strs)
    return [
      pairs,
      bias === 'left'
        ? _.findLast(pairs, ([offset]) => offset < strIndex)
        : _.findLast(pairs, ([offset]) => offset <= strIndex),
    ]
  }

  insertChar(start: number, c: string, bias: Direction = 'left'): SplitString {
    const [pairs, startPair] = this.getPair(start, bias)
    const startIdx = pairs.indexOf(startPair)
    const [startOffset, startStr] = startPair
    return new SplitString([
      ...this.strs.slice(0, startIdx),
      startStr.substr(0, start - startOffset) + c + startStr.substr(start - startOffset),
      ...this.strs.slice(startIdx + 1),
    ])
  }

  backspace(start: number): SplitString {
    const pairs = offsetZip(this.strs)
    const startPair = _.findLast(pairs, ([offset]) => offset < start)
    const startIdx = pairs.indexOf(startPair)
    const [startOffset, startStr] = startPair
    return new SplitString([
      ...this.strs.slice(0, startIdx),
      startStr.substr(0, start - startOffset - 1) + startStr.substr(start - startOffset),
      ...this.strs.slice(startIdx + 1),
    ])
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
      startStr.substr(0, start - startOffset) + endStr.substr(end - endOffset),
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

  backspace(): TOM {
    const article = this.root.querySelector('article')
    const sel = new Jerry(article).getSelection()
    if (sel.start !== sel.end || !sel.start) return this
    if (sel.bias === 'left') {
      const contentLength = contentToStrings(this.content).length
      const newModel = new TOM({
        blocks: this.content.blocks.backspace(sel.start),
        links: [],
      }, this.root)
      newModel.content.links = _.compact([
        {
          origin: new Address(newModel.content, 0, sel.start - 1),
          dest: new Address(this.content, 0, sel.start - 1),
        },
        {
          origin: new Address(newModel.content, sel.start - 1, contentLength - 1),
          dest: new Address(this.content, sel.start, contentLength),
        },
      ])
      return newModel
    }

    // merge adjacent paragraphs in this case
    const contentLength = contentToStrings(this.content).length
    const [pairs, latterPair] = this.content.blocks.getPair(sel.start, 'right')
    const latterIdx = pairs.indexOf(latterPair)
    const formerIdx = latterIdx - 1
    const formerPair = pairs[latterIdx - 1]
    if (!formerPair) return this
    const newModel = new TOM({
      blocks: new SplitString([
        ...this.content.blocks.strs.slice(0, formerIdx),
        formerPair[1] + latterPair[1],
        ...this.content.blocks.strs.slice(latterIdx + 1),
      ]),
      links: [],
    }, this.root)
    newModel.content.links = _.compact([
      {
        origin: new Address(newModel.content, 0, contentLength),
        dest: new Address(this.content, 0, contentLength),
      },
    ])
    return newModel
  }

  emptySelection(): boolean {
    const article = this.root.querySelector('article')
    const sel = new Jerry(article).getSelection()
    return sel.start === sel.end
  }

  deleteSelection(): TOM {
    const article = this.root.querySelector('article')
    const sel = new Jerry(article).getSelection()
    if (sel.start === sel.end) return this.backspace()
    const atoms = sel.toAtoms()
    const first: jerry.Address = atoms[0]
    const last: jerry.Address = _.last(atoms)
    const parents = _.uniq(_.map(atoms, 'root.parentNode'))
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

  insertChar(c: string): TOM {
    const article = this.root.querySelector('article')
    const j = new Jerry(article)
    const sel = j.getSelection()
    if (sel.start !== sel.end) {
      // TODO: implement insert/delete
      return this
    }

    const contentLength = contentToStrings(this.content).length
    const newModel = new TOM({
      blocks: this.content.blocks.insertChar(sel.start, c, sel.bias),
      links: [],
    }, this.root)
    newModel.content.links = _.compact([
      sel.start && {
        origin: new Address(newModel.content, 0, sel.start),
        dest: new Address(this.content, 0, sel.start),
      },
      sel.end !== contentLength && {
        origin: new Address(newModel.content, sel.start + 1, contentLength + 1),
        dest: new Address(this.content, sel.start, contentLength),
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
            article.setAttribute('contentEditable', false)
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
        const specialKeys = {'Space': ' ', 'Period': '.'}
        if (evt.code === 'Backspace') {
          const isEmpty = model.emptySelection()
          if (!isEmpty) evt.preventDefault()
          const newModel = isEmpty ? model.backspace() : model.deleteSelection()
          onChange(newModel)
        } else if (evt.code.startsWith('Key') || specialKeys[evt.code]) {
          const key = specialKeys[evt.code] || evt.key
          const newModel = model.insertChar(key)
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

function composeLinks2({origin: originA, dest: destB}, {origin: originB, dest: destC}) {
  const b_to_c = b => b - originB.start + destC.start
  const c_to_b = c => c - destC.start + originB.start
  const b_to_a = b => b - destB.start + originA.start
  const c_to_a = c => b_to_a(c_to_b(c))
  const destFull = new Address(destC.basis, b_to_c(destB.start), b_to_c(destB.end))
  if (destFull.start <= destC.start && destFull.end <= destC.start) return null
  if (destFull.start >= destC.end && destFull.end >= destC.end) return null
  const dest = new Address(
    destC.basis,
    Math.max(destC.start, destFull.start),
    Math.min(destC.end, destFull.end)
  )
  const origin = new Address(originA.basis, c_to_a(dest.start), c_to_a(dest.end))
  return {origin, dest}
}

function composeLinks(abs, bcs) {
  // TODO: can maybe do more efficiently than enumerating all pairs
  const pairs = _.flatMap(abs, ab => bcs.map(bc => composeLinks2(ab, bc)))
  return _.compact(pairs)
}

function getHistory(content) {
  const basis = _.find(content.links, 'dest.basis')?.dest?.basis
  return [content, ...(basis ? getHistory(basis) : [])]
}

export default function App({content}) {
  const [version, setVersion] = React.useState(0)
  const [model, setModel] = React.useState(new TOM(content))
  const history = getHistory(model.content)
  const basis = history[1]
  const bbasis = history[2]
  const root = _.last(history)
  return (
    <div className='pages'>
      <Tom
        title={'Man in Universe' + (basis ? ' | Edited' : '')}
        model={model}
        onChange={m => {
          setModel(m)
          setVersion(x => x + 1)
        }}
      />
      {/*basis && <Tom
        key={version}
        model={new TOM(basis)}
        links={_.map(model.content.links, 'dest')}
        immutable
      />*/}
      {history.length > 1 && <Tom
        key={`${version}^`}
        title="Man in Universe | Original"
        model={new TOM(root)}
        links={_.map(_.initial(history).map(x => x.links).reduce(composeLinks), 'dest')}
        immutable
      />}
    </div>
  )
}
