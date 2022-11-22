import React from 'react'
import Jerry, * as jerry from 'jerrymander'
import _ from 'lodash'
import cx from 'classnames'
import './main.scss'
import {Interval, Ribbon, Ribbons} from './ribbons'

class Bud {
  type: string

  getLength(): number {
    return 0
  }

  toHtmlNode() {
    return null
  }
}

class TextBud extends Bud {
  content: string
  constructor(content: string) {
    super()
    this.type = 'text'
    this.content = content
  }

  getLength() {
    return this.content.length
  } 

  toHtmlNode() {
    return document.createTextNode(this.content)
  }
}

class RefBud extends Bud {
  src: Interval<Page>
  displayMode: string
  constructor(src: Interval<Page>, displayMode = 'quote') {
    super()
    this.type = 'ref'
    this.displayMode = displayMode
    this.src = src
  }

  getLength() {
    return 1
  } 

  toHtmlNode() {
    const div = document.createElement('div')
    div.dataset.jerryType = 'blackbox'
    div.setAttribute('contentEditable', 'false')
    div.classList.add('refbud')
    const signpost = document.createElement('span')
    signpost.innerText = '|'
    signpost.dataset.jerryType = 'signpost'
    signpost.classList.add('signpost')
    div.appendChild(signpost)
    if (this.displayMode === 'quote') {
      div.classList.add('quote')
      const preview = document.createElement('p')
      const content = this.src.basis.budList.readRange(this.src.start, this.src.end)
      preview.innerText = content
      div.appendChild(preview)
    }
    if (this.displayMode === 'bud') {
      div.classList.add('bud')
      const title = document.createElement('span')
      title.classList.add('title')
      title.innerText = this.src.basis.id
      div.appendChild(title)
    }
    if (this.displayMode === 'card') {
      div.classList.add('card')
      const title = document.createElement('h2')
      title.classList.add('title')
      title.innerText = this.src.basis.id
      div.appendChild(title)
      const preview = document.createElement('p')
      const content = this.src.basis.budList.readRange(this.src.start, this.src.end)
      preview.innerText = content
      div.appendChild(preview)
    }
    return div
  }
}

class Branch extends Bud {
  sources: Interval<Page>[]
  activeTab: number
  displayMode: string
  constructor(sources: Interval<Page>[], displayMode = 'quote') {
    super()
    this.type = 'branch'
    this.displayMode = displayMode
    this.sources = sources
    this.activeTab = 0
  }

  getLength() {
    return this.displayMode === 'quote' ? 1 : this.sources.length
  } 

  toHtmlNode() {
    const div = document.createElement('div')
    div.dataset.jerryType = 'blackbox'
    div.setAttribute('contentEditable', 'false')
    div.classList.add('branch')
    div.classList.add(this.displayMode)
    if (this.displayMode === 'quote') {
      const tabBar = document.createElement('div')
      tabBar.classList.add('tabBar')
      this.sources.forEach(source => {
        const title = source.basis.id
        const tab = document.createElement('div')
        tab.classList.add('tab')
        tab.innerText = title
        tabBar.appendChild(tab)
      })
      div.appendChild(tabBar)
      const container = document.createElement('div')
      container.classList.add('container')
      div.appendChild(container)
      const renderTab = tabNum => {
        Array.from(container.childNodes).forEach(childNode => childNode.parentNode.removeChild(childNode))
        container.appendChild(new RefBud(this.sources[tabNum]).toHtmlNode())


        Array.from(tabBar.childNodes as any).forEach((tab: any, i) => {
          if (i === this.activeTab) {
            tab.classList.add('active')
          } else {
            tab.classList.remove('active')
          }
        })
      }
      renderTab(this.activeTab)

      Array.from(tabBar.childNodes).forEach((tab, i) => {
        tab.addEventListener('click', () => {
          console.log('click', i)
          this.activeTab = i
          renderTab(i)
        })
      })
    }

    if (this.displayMode === 'card') {
      this.sources.forEach(source => {
        div.appendChild(new RefBud(source, 'card').toHtmlNode())
      })
    }

    if (this.displayMode === 'bud') {
      this.sources.forEach(source => {
        div.appendChild(new RefBud(source, 'bud').toHtmlNode())
      })
    }

    return div
  }
}

type Direction = 'left' | 'right' | 'neither'
type Pair = [number, Bud]

function budLength(bud) {
  return bud.getLength()
}

function offsetZip(xs: Bud[]): [number, Bud][] {
  let offset = 0
  let chunks = []
  xs.forEach(bud => {
    chunks.push([offset, bud])
    offset += bud.getLength()
  })
  return chunks
}

class BudList {
  buds: Bud[]
  length: number
  constructor(buds: (string | Bud)[]) {
    this.buds = _.compact(buds).map(str => _.isString(str) ? new TextBud(str) : str)
    this.length = _.sumBy(this.buds, budLength)
  }

  getPair(strIndex: number, bias: Direction = 'left'): [Pair[], Pair] {
    const pairs = offsetZip(this.buds)
    return [
      pairs,
      bias === 'left' || bias === 'neither'
        ? _.findLast(pairs, ([offset]) => offset < strIndex)
        : _.findLast(pairs, ([offset]) => offset <= strIndex),
    ]
  }

  insertChar(start: number, c: string, bias: Direction = 'left'): BudList {
    const [pairs, startPair] = this.getPair(start, bias)
    const startIdx = pairs.indexOf(startPair)
    const [startOffset, startBud] = startPair
    if (!(startBud instanceof TextBud)) {
      // Can't insert into non-text bud
      return
    }
    const startStr = startBud.content
    if (bias === 'neither') {
      // the case when cursor is in a new, blank block
      return new BudList([
        ...this.buds.slice(0, startIdx + 1),
        c,
        ...this.buds.slice(startIdx + 1),
      ])
    }
    return new BudList([
      ...this.buds.slice(0, startIdx),
      startStr.substr(0, start - startOffset) + c + startStr.substr(start - startOffset),
      ...this.buds.slice(startIdx + 1),
    ])
  }

  replaceBuds(start: number, end: number, newBud: Bud): BudList {
    const [pairs, startPair] = this.getPair(start, 'right')
    const [pairs2, endPair] = this.getPair(end, 'left')
    const startIdx = pairs.indexOf(startPair)
    const endIdx = pairs2.indexOf(endPair)
    return new BudList([
      ...this.buds.slice(0, startIdx),
      newBud,
      ...this.buds.slice(endIdx + 1),
    ])
  }

  backspace(start: number): BudList {
    const pairs = offsetZip(this.buds)
    const startPair = _.findLast(pairs, ([offset]) => offset < start)
    const startIdx = pairs.indexOf(startPair)
    const [startOffset, startBud] = startPair
    if (!(startBud instanceof TextBud)) {
      // TODO: can backspace by removing non-text buds
      return
    }
    const startStr = startBud.content
    return new BudList([
      ...this.buds.slice(0, startIdx),
      startStr.substr(0, start - startOffset - 1) + startStr.substr(start - startOffset),
      ...this.buds.slice(startIdx + 1),
    ])
  }

  deleteRange(start: number, end: number): BudList {
    const pairs = offsetZip(this.buds)
    const startPair = _.findLast(pairs, ([offset]) => offset <= start)
    const endPair = _.findLast(pairs, ([offset]) => offset < end)
    const startIdx = pairs.indexOf(startPair)
    const endIdx = pairs.indexOf(endPair)
    const [startOffset, startBud] = startPair
    const [endOffset, endBud] = endPair
    if (!(startBud instanceof TextBud) || !(endBud instanceof TextBud)) {
      // TODO: can delete non-text buds but not supported yet
      return
    }
    const startStr = startBud.content
    const endStr = endBud.content
    if (startIdx === endIdx) {
      return new BudList([
        ...this.buds.slice(0, startIdx),
        startStr.substr(0, start - startOffset) + endStr.substr(end - startOffset),
        ...this.buds.slice(endIdx + 1),
      ])
    }
    return new BudList([
      ...this.buds.slice(0, startIdx),
      startStr.substr(0, start - startOffset) + endStr.substr(end - endOffset),
      ...this.buds.slice(endIdx + 1),
    ])
  }

  readRange(start: number, end: number): string {
    const pairs = offsetZip(this.buds)
    const startPair = _.findLast(pairs, ([offset]) => offset <= start)
    const endPair = _.findLast(pairs, ([offset]) => offset < end)
    const startIdx = pairs.indexOf(startPair)
    const endIdx = pairs.indexOf(endPair)
    const [startOffset, startBud] = startPair
    const [endOffset, endBud] = endPair
    if (!(startBud instanceof TextBud) || !(endBud instanceof TextBud)) {
      // TODO: can read non-text buds but not supported yet
      return
    }
    const startStr = startBud.content
    const endStr = endBud.content
    if (startIdx === endIdx) {
      return startStr.substr(start - startOffset, end - start)
    }
    // TODO: I believe this misses the case of spanning some intervening buds
    return startStr.substr(start - startOffset) + endStr.substr(0, end - endOffset)
  }
}

function budsToHtml(budList: BudList): Element {
  const article = document.createElement('article')
  budList.buds.forEach(bud => {
    const p = document.createElement('p')
    p.appendChild(bud.toHtmlNode())
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
  budList: BudList
  ribbons: Ribbons<Page>

  constructor(budList: BudList | string, node: Element = null) {
    this.id = _.uniqueId('page-')
    this.root = node
    this.budList = _.isString(budList)
      ? new BudList(budList.split('\n\n'))
      : budList
  }

  render(node: Element) {
    this.root = node
    this.root.appendChild(budsToHtml(this.budList))
  }

  backspace(): Page {
    const article = this.root.querySelector('article')
    const sel = new Jerry(article).getSelection()
    if (sel.start !== sel.end || !sel.start) return this
    if (sel.bias === 'left') {
      const contentLength = _.sumBy(this.budList.buds, budLength)
      const newModel = new Page(this.budList.backspace(sel.start), this.root)
      newModel.ribbons = new Ribbons([
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
    const contentLength = _.sumBy(this.budList.buds, budLength)
    const [pairs, latterPair] = this.budList.getPair(sel.start, 'right')
    const latterIdx = pairs.indexOf(latterPair)
    const formerIdx = latterIdx - 1
    const formerPair = pairs[latterIdx - 1]
    if (!formerPair) return this
    const newModel = new Page(
      new BudList([
        ...this.budList.buds.slice(0, formerIdx),
        ...((formerPair[1] instanceof TextBud && latterPair[1] instanceof TextBud) ?
            [formerPair[1].content + latterPair[1].content] :
            [formerPair[1], latterPair[1]]
        ),
        ...this.budList.buds.slice(latterIdx + 1),
      ]),
      this.root
    )
    newModel.ribbons = new Ribbons([
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
    const signposts = parents.filter(p => p.dataset.jerryType === 'signpost')
    parents.forEach(p => {
      if (p.dataset.jerryType === 'signpost') {
        const blackbox = p.closest('[data-jerry-type=blackbox]')
        blackbox.parentNode.removeChild(blackbox)
      }
    })
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
    const contentLength = _.sumBy(this.budList.buds, budLength)
    const newModel = new Page(
      this.budList.deleteRange(sel.start, sel.end),
      this.root
    )
    newModel.ribbons = new Ribbons([
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

  quote(): Page {
    const article = this.root.querySelector('article')
    const jerry = new Jerry(article)
    const sel = jerry.getSelection()
    const leafs = sel.toLeafs()

    let refBud = null
    let fullInterval = new Interval<Page>(this, _.min(_.map(leafs, 'start')), _.max(_.map(leafs, 'end')))
    if (leafs.length === 1) {
      const leaf = jerry.getNodeAddress(leafs[0].root).rebase(article)
      const refInterval = new Interval<Page>(this, leaf.start, leaf.end)
      refBud = new RefBud(refInterval)
    } else {
      // TODO: this is not the long-term behavior
      // this is a shortcut for implementing the branch bud-type
      // in the future, stack and quote over multiple paragraphs will be distinct operations
      const intervals = leafs.map(leaf => {
        const rebasedLeaf = jerry.getNodeAddress(leaf.root).rebase(article)
        return new Interval<Page>(this, rebasedLeaf.start, rebasedLeaf.end)
      })
      refBud = new Branch(intervals)
    }

    const parentNode = leafs[0].root.parentNode
    const quoteNode = refBud.toHtmlNode()
    _.tail(leafs).forEach((leaf: any) => leaf.root.parentNode.removeChild(leaf.root))
    parentNode.replaceChild(quoteNode, leafs[0].root)
    window.getSelection().empty()

    const contentLength = _.sumBy(this.budList.buds, budLength)
    const newModel = new Page(
      this.budList.replaceBuds(sel.start, sel.end, refBud),
      this.root
    )
    const insertedLength = refBud.getLength()
    newModel.ribbons = new Ribbons([
      fullInterval.start && new Ribbon(
        new Interval(newModel, 0, fullInterval.start),
        new Interval(this, 0, fullInterval.start)
      ),
      fullInterval.end !== contentLength && new Ribbon(
        new Interval(newModel, fullInterval.start + insertedLength, contentLength - (fullInterval.end - fullInterval.start) + insertedLength),
        new Interval(this, fullInterval.end, contentLength)
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

    const contentLength = _.sumBy(this.budList.buds, budLength)
    const newModel = new Page(
      this.budList.insertChar(sel.start, c, sel.bias),
      this.root
    )
    newModel.ribbons = new Ribbons([
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

    const refText = basis.budList.readRange(start, end)
    const contentLength = _.sumBy(this.budList.buds, budLength)
    const newModel = new Page(
      this.budList.insertChar(sel.start, refText, sel.bias),
      this.root
    )
    newModel.ribbons = new Ribbons([
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
        // TODO: implement Enter
        if (evt.code === 'Backspace') {
          const isEmpty = page.emptySelection()
          if (!isEmpty) evt.preventDefault()
          const newModel = isEmpty ? page.backspace() : page.deleteSelection()
          onChange(newModel)
        } else if (evt.code === 'Period' && evt.shiftKey) {
          const isEmpty = page.emptySelection()
          if (isEmpty) return
          evt.preventDefault()
          onChange(page.quote())
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
    {/*<div className="page" dangerouslySetInnerHTML={{__html: budsToHtml(page.budList).outerHTML}} />*/}
    </div>
  )
}
