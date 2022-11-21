import React from 'react'
import Jerry, * as jerry from 'jerrymander'
import _ from 'lodash'
import cx from 'classnames'
import './main.scss'
import {Interval, Ribbon, Ribbons} from './ribbons'

function offsetZip(xs: string[]): [number, string][] {
  let offset = 0
  let chunks = []
  xs.forEach(x => {
    chunks.push([offset, x])
    offset += x.length
  })
  return chunks
}

type Direction = 'left' | 'right' | 'neither'
type Pair = [number, string]

class Buds {
  strs: string[]
  length: number
  constructor(strs: string[]) {
    this.strs = strs
    this.length = _.sumBy(strs, 'length')
  }

  getPair(strIndex: number, bias: Direction = 'left'): [Pair[], Pair] {
    const pairs = offsetZip(this.strs)
    return [
      pairs,
      bias === 'left' || bias === 'neither'
        ? _.findLast(pairs, ([offset]) => offset < strIndex)
        : _.findLast(pairs, ([offset]) => offset <= strIndex),
    ]
  }

  insertChar(start: number, c: string, bias: Direction = 'left'): Buds {
    const [pairs, startPair] = this.getPair(start, bias)
    const startIdx = pairs.indexOf(startPair)
    const [startOffset, startStr] = startPair
    if (bias === 'neither') {
      // the case when cursor is in a new, blank block
      return new Buds([
        ...this.strs.slice(0, startIdx + 1),
        c,
        ...this.strs.slice(startIdx + 1),
      ])
    }
    return new Buds([
      ...this.strs.slice(0, startIdx),
      startStr.substr(0, start - startOffset) + c + startStr.substr(start - startOffset),
      ...this.strs.slice(startIdx + 1),
    ])
  }

  backspace(start: number): Buds {
    const pairs = offsetZip(this.strs)
    const startPair = _.findLast(pairs, ([offset]) => offset < start)
    const startIdx = pairs.indexOf(startPair)
    const [startOffset, startStr] = startPair
    return new Buds([
      ...this.strs.slice(0, startIdx),
      startStr.substr(0, start - startOffset - 1) + startStr.substr(start - startOffset),
      ...this.strs.slice(startIdx + 1),
    ])
  }

  deleteRange(start: number, end: number): Buds {
    const pairs = offsetZip(this.strs)
    const startPair = _.findLast(pairs, ([offset]) => offset <= start)
    const endPair = _.findLast(pairs, ([offset]) => offset < end)
    const startIdx = pairs.indexOf(startPair)
    const endIdx = pairs.indexOf(endPair)
    const [startOffset, startStr] = startPair
    const [endOffset, endStr] = endPair
    if (startIdx === endIdx) {
      return new Buds([
        ...this.strs.slice(0, startIdx),
        startStr.substr(0, start - startOffset) + endStr.substr(end - startOffset),
        ...this.strs.slice(endIdx + 1),
      ])
    }
    return new Buds([
      ...this.strs.slice(0, startIdx),
      startStr.substr(0, start - startOffset) + endStr.substr(end - endOffset),
      ...this.strs.slice(endIdx + 1),
    ])
  }

  readRange(start: number, end: number): string {
    const pairs = offsetZip(this.strs)
    const startPair = _.findLast(pairs, ([offset]) => offset <= start)
    const endPair = _.findLast(pairs, ([offset]) => offset < end)
    const startIdx = pairs.indexOf(startPair)
    const endIdx = pairs.indexOf(endPair)
    const [startOffset, startStr] = startPair
    const [endOffset, endStr] = endPair
    if (startIdx === endIdx) {
      return startStr.substr(start - startOffset, end - start)
    }
    // TODO: I believe this misses the case of spanning some intervening buds
    return startStr.substr(start - startOffset) + endStr.substr(0, end - endOffset)
  }
}

type Content = {buds: Buds, ribbons: Ribbons<Page>}

function contentToStrings(content: Content): Buds {
  return content.buds
}

function contentToHtml(content: Content): Element {
  const article = document.createElement('article')
  content.buds.strs.forEach(content => {
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

export class Page {
  root: Element
  id: string
  content: Content

  constructor(content: Content | string, node: Element = null) {
    this.id = _.uniqueId('page-')
    this.root = node
    this.content = _.isString(content)
      ? { buds: new Buds(content.split('\n\n')), ribbons: new Ribbons([]) }
      : content
  }

  render(node: Element) {
    this.root = node
    this.root.appendChild(contentToHtml(this.content))
  }

  backspace(): Page {
    const article = this.root.querySelector('article')
    const sel = new Jerry(article).getSelection()
    if (sel.start !== sel.end || !sel.start) return this
    if (sel.bias === 'left') {
      const contentLength = contentToStrings(this.content).length
      const newModel = new Page({
        buds: this.content.buds.backspace(sel.start),
        ribbons: new Ribbons([]),
      }, this.root)
      newModel.content.ribbons = new Ribbons([
        new Ribbon(
          new Interval(newModel, 0, sel.start - 1),
          new Interval(this, 0, sel.start - 1)
        ),
        new Ribbon(
          new Interval(newModel, sel.start - 1, contentLength - 1),
          new Interval(this, sel.start, contentLength)
        ),
      ])
      return newModel
    }

    // merge adjacent paragraphs in this case
    const contentLength = contentToStrings(this.content).length
    const [pairs, latterPair] = this.content.buds.getPair(sel.start, 'right')
    const latterIdx = pairs.indexOf(latterPair)
    const formerIdx = latterIdx - 1
    const formerPair = pairs[latterIdx - 1]
    if (!formerPair) return this
    const newModel = new Page({
      buds: new Buds([
        ...this.content.buds.strs.slice(0, formerIdx),
        formerPair[1] + latterPair[1],
        ...this.content.buds.strs.slice(latterIdx + 1),
      ]),
      ribbons: new Ribbons([]),
    }, this.root)
    newModel.content.ribbons = new Ribbons([
      new Ribbon(
        new Interval(newModel, 0, contentLength),
        new Interval(this, 0, contentLength)
      ),
    ])
    return newModel
  }

  emptySelection(): boolean {
    const article = this.root.querySelector('article')
    const sel = new Jerry(article).getSelection()
    return sel.start === sel.end
  }

  deleteSelection(): Page {
    const article = this.root.querySelector('article')
    const sel = new Jerry(article).getSelection()
    if (sel.start === sel.end) return this.backspace()
    const atoms = sel.toAtoms()
    const first: jerry.Interval = atoms[0]
    const last: jerry.Interval = _.last(atoms)
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
    const newModel = new Page({
      buds: this.content.buds.deleteRange(sel.start, sel.end),
      ribbons: new Ribbons([]),
    }, this.root)
    newModel.content.ribbons = new Ribbons([
      sel.start && new Ribbon(
        new Interval(newModel, 0, sel.start),
        new Interval(this, 0, sel.start)
      ),
      sel.end !== contentLength && new Ribbon(
        new Interval(newModel, sel.start, contentLength - (sel.end - sel.start)),
        new Interval(this, sel.end, contentLength)
      ),
    ])
    return newModel
  }

  insertChar(c: string): Page {
    const article = this.root.querySelector('article')
    const j = new Jerry(article)
    const sel = j.getSelection()
    if (sel.start !== sel.end) {
      // TODO: implement insert/delete
      return this
    }

    const contentLength = contentToStrings(this.content).length
    const newModel = new Page({
      buds: this.content.buds.insertChar(sel.start, c, sel.bias),
      ribbons: new Ribbons([]),
    }, this.root)
    newModel.content.ribbons = new Ribbons([
      sel.start && new Ribbon(
        new Interval(newModel, 0, sel.start),
        new Interval(this, 0, sel.start)
      ),
      sel.end !== contentLength && new Ribbon(
        new Interval(newModel, sel.start + 1, contentLength + 1),
        new Interval(this, sel.start, contentLength)
      ),
    ])
    return newModel
  }

  insertReference(basis: Page, start: number, end: number): Page {
    const article = this.root.querySelector('article')
    const j = new Jerry(article)
    const sel = j.getSelection()
    if (sel.start !== sel.end) {
      // TODO: implement insert/delete
      return this
    }

    const refText = basis.content.buds.readRange(start, end)
    const contentLength = contentToStrings(this.content).length
    const newModel = new Page({
      buds: this.content.buds.insertChar(sel.start, refText, sel.bias),
      ribbons: new Ribbons([]),
    }, this.root)
    newModel.content.ribbons = new Ribbons([
      sel.start && new Ribbon(
        new Interval(newModel, 0, sel.start),
        new Interval(this, 0, sel.start)
      ),
      new Ribbon(
        new Interval(newModel, sel.start, sel.start + (end - start)),
        new Interval(basis, start, end)
      ),
      sel.end !== contentLength && new Ribbon(
        new Interval(newModel, sel.start + refText.length, contentLength + refText.length),
        new Interval(this, sel.start, contentLength)
      ),
    ])
    return newModel
  }
}

export function Tom({
  page,
  getPage,
  ribbons = [],
  onChange = null,
}) {
  return (
    <div
      className='page'
      key="mutable"
      onCopy={evt => {
        const article = evt.target.closest('article')
        if (!article) return
        const sel = new Jerry(article).getSelection()
        const content = sel.getContent()
        evt.clipboardData.setData('text/plain', content)
        evt.clipboardData.setData('jerry', page.id + ':' + [sel.start, sel.end].join('-'))
        evt.preventDefault()
      }}
      onPaste={evt => {
        const data = evt.clipboardData.getData('jerry')
        if (!data) {
          evt.preventDefault()
          return
        }
        const [basisId, range] = data.split(':')
        const [start, end] = range.split('-').map(x => +x)
        const newModel = page.insertReference(getPage(basisId), start, end)
        onChange(newModel)
      }}
      ref={ref => {
        if (ref && !ref.querySelector('article')) {
          page.render(ref)
        }
      }}
      onKeyDown={evt => {
        const specialKeys = {'Space': ' ', 'Period': '.', 'Minus': '-', 'Quote': '\''}
        if (evt.code === 'Backspace') {
          const isEmpty = page.emptySelection()
          if (!isEmpty) evt.preventDefault()
          const newModel = isEmpty ? page.backspace() : page.deleteSelection()
          onChange(newModel)
        } else if (evt.code.startsWith('Key') || specialKeys[evt.code]) {
          if (evt.metaKey || evt.ctrlKey) {
            return
          } else {
            const key = specialKeys[evt.code] || evt.key
            const newModel = page.insertChar(key)
            onChange(newModel)
          }
        } else if (evt.code === 'Escape') {
          // TODO
          evt.preventDefault()
        } else if (evt.code !== 'Enter') {
          evt.preventDefault()
        }
      }}
    >
      <header>
        <h1>{page.id}</h1>
      </header>
    </div>
  )
}

export default function App({content}) {
  const defaultPage = new Page(content)
  const [pages, setPages] = React.useState(_.keyBy([defaultPage], 'id'))
  const [page, setPage] = React.useState(defaultPage)
  console.log('pages', pages)

  return (
    <div className='pages'>
      <Tom
        page={page}
        getPage={(id: string) => pages[id]}
        onChange={page => {
          setPage(page)
          setPages(pages => ({...pages, [page.id]: page}))
        }}
      />
    {/*<div className="page" dangerouslySetInnerHTML={{__html: contentToHtml(page.content).outerHTML}} />*/}
    </div>
  )
}
