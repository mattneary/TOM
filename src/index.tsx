import React from 'react'
import _ from 'lodash'
import Jerry, {Address} from 'jerrymander'
import './main.scss'

type Entry = {type: 'entry', content: string, length: number}
type Link = {type: 'link', start: number, length: number, basis: Content}
type Block = {items: (Entry | Link)[]}
type Content = Block[]

function offsetZip(xs: string[]): [number, string][] {
  let offset = 0
  let chunks = []
  xs.forEach(x => {
    chunks.push([offset, x])
    offset += x.length
  })
  return chunks
}

function linkText(link: Link): string[] {
  const chunks = offsetZip(contentToStrings(link.basis))
  const startChunk = _.findLast(chunks, ([offset]) => offset <= link.start)
  const endChunk = _.findLast(chunks, ([offset]) => offset < link.start + link.length)
  const startIdx = chunks.indexOf(startChunk)
  const endIdx = chunks.indexOf(endChunk)
  if (startIdx === endIdx) {
    const [offset, content] = startChunk
    return [
      ...(link.start === offset ? [''] : []),
      content.substr(link.start - offset, link.length),
    ]
  }

  const [startOffset, startContent] = startChunk
  const [endOffset, endContent] = endChunk
  return [
    ...(link.start === startOffset ? [''] : []),
    startContent.substr(link.start - startOffset),
    ..._.map(chunks.slice(startIdx + 1, endIdx), 1),
    endContent.substr(0, (link.start + link.length) - endOffset),
  ]
}

function contentToStrings(content: Content): string[] {
  return _.flatMap(content.map(({items}) => {
    let currentContent = ''
    let chunks = []
    items.forEach(item => {
      if (item.type === 'link') {
        const xs = linkText(item)
        if (xs.length > 1) {
          chunks.push(currentContent + xs[0])
          chunks = [...chunks, ...xs.slice(1)]
          currentContent = chunks.pop()
        } else {
          currentContent += xs[0]
        }
      } else if (item.type === 'entry') {
        currentContent += item.content
      }
    })
    return currentContent ? [...chunks, currentContent] : chunks
  }))
}

function contentToHtml(content: Content): Element {
  const article = document.createElement('article')
  content.forEach(({items}) => {
    const p = document.createElement('p')
    items.forEach(item => {
      if (item.type === 'entry') {
        p.appendChild(document.createTextNode(item.content))
      } else if (item.type === 'link') {
        const strs = linkText(item)
        strs.forEach(str => p.appendChild(document.createTextNode(str)))
      }
    })
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
      ? content.split('\n\n').map(x => ({
        items: [{type: 'entry', content: x, length: x.length}],
      }))
      : content
  }

  render(node: Element) {
    this.root = node
    this.root.appendChild(contentToHtml(this.content))
  }

  deleteSelection() {
    const article = this.root.querySelector('article')
    const sel = new Jerry(article).getSelection()
    if (sel.start === sel.end) {
      // TODO: implement normal backspace
      return
    }
    const atoms = sel.toAtoms()
    const first: Address = atoms[0]
    const last: Address = _.last(atoms)
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

    const contentLength = _.sumBy(contentToStrings(this.content), 'length')
    this.content = [{
      items: _.compact([
        sel.start && {
          type: 'link',
          start: 0,
          length: sel.start,
          basis: this.content,
        },
        sel.end !== contentLength && {
          type: 'link',
          start: sel.end,
          length: contentLength - sel.end,
          basis: this.content,
        },
      ])
    }]

    window.getSelection().empty()
  }
}

export default function Tom({model}) {
  const [content, setContent] = React.useState<Content>(null)
  const contentLength = content && _.sumBy(contentToStrings(content), 'length')
  const link: Content = content && [{
    items: [{
      type: 'link',
      start: 0,
      length: contentLength,
      basis: content,
    }],
  }]
  return (
    <div className='pages'>
      <div
        className='page'
        ref={ref => {
          if (ref && !ref.querySelector('article')) {
            setContent(model.content)
            model.render(ref)
          }
        }}
        onKeyDown={evt => {
          evt.preventDefault()
          if (evt.code === 'Backspace') {
            model.deleteSelection()
            setContent(model.content)
          }
        }}
      >
        <header>
          <h1>Man in Universe</h1>
        </header>
      </div>
      <div className='page'>
        <header>
          <h1>Man in Universe</h1>
          <article>
            {link && contentToStrings(link).map(text => <p>{text}</p>)}
          </article>
        </header>
      </div>
    </div>
  )
}
