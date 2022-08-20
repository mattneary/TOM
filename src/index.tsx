import React from 'react'
import _ from 'lodash'
import Jerry, * as jerry from 'jerrymander'
import cx from 'classnames'
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

  toString(): string {
    return this.basis.blocks.id + ':' + [this.start, this.end].join('-')
  }

  toJerry(root): jerry.Address {
    return new jerry.Address(root, this.start, this.end)
  }

  intersect(otherAddress: Address): Address {
    if (this.basis !== otherAddress.basis) return null
    const implied = new Address(
      this.basis,
      Math.max(this.start, otherAddress.start),
      Math.min(this.end, otherAddress.end)
    )
    const isEmpty = implied.end <= implied.start
    return isEmpty ? null : implied
  }

  touching(otherAddress: Address): boolean {
    if (this.basis !== otherAddress.basis) return false
    if (this.intersect(otherAddress)) return true
    if (this.start === otherAddress.end || otherAddress.start === this.end) return true
    return false
  }

  sameBasis(otherAddress: Address) {
    return this.basis === otherAddress.basis
  }

  diff2(otherAddress: Address): Address[] {
    if (this.basis !== otherAddress.basis) return [this]
    if (!this.intersect(otherAddress)) return [this]
    const startsAfter = otherAddress.start > this.start
    const endsBefore = otherAddress.end < this.end
    if (endsBefore && startsAfter) {
      return [
        new Address(this.basis, this.start, otherAddress.start),
        new Address(this.basis, otherAddress.end, this.end),
      ]
    }
    if (startsAfter) return [new Address(this.basis, this.start, otherAddress.start)]
    if (endsBefore) return [new Address(this.basis, otherAddress.end, this.end)]
    return []
  }
}

function diffAddresses(xs: Address[], ys: Address[]): Address[] {
  if (_.isEmpty(xs)) return []
  if (_.isEmpty(ys)) return xs
  if (xs.length === 1) return diffAddresses(xs[0].diff2(ys[0]), _.tail(ys))
  return [...diffAddresses([xs[0]], ys), ...diffAddresses(_.tail(xs), ys)]
}

function sortAddresses(addrs: Address[]): Address[] {
  const bases = _.map(addrs, 'basis')
  return _.orderBy(addrs, [x => bases.indexOf(x.basis), 'start'], ['asc', 'asc'])
}

function normalizeAddresses(addrs: Address[]): Address[] {
  let grouped = new Map<Content, Address[]>()
  const sorted = sortAddresses(addrs)
  sorted.forEach(addr => {
    grouped.set(addr.basis, [...(grouped.get(addr.basis) || []), addr])
  })
  return _.flatMap(Array.from(grouped.entries()), ([b, xs]: [any, Address[]]) => {
    return xs.reduce((a, x) => {
      if (_.isEmpty(a)) return [x]
      if (_.last(a).touching(x)) {
        const y = _.last(a)
        return [..._.initial(a), new Address(y.basis, Math.min(x.start, y.start), Math.max(x.end, y.end))]
      }
      return [...a, x]
    }, [])
  })
}

class Link {
  origin: Address
  dest: Address
  constructor(origin: Address, dest: Address) {
    this.origin = origin
    this.dest = dest
  }

  toString(): string {
    return [this.origin.toString(), this.dest.toString()].join(' -> ')
  }

  invert() {
    return new Link(this.dest, this.origin)
  }

  translate(point: number): number {
    return point - this.origin.start + this.dest.start
  }

  translateI(addr: Address): Address {
    if (this.origin.basis !== addr.basis) return null
    const extrapolate = new Address(this.dest.basis, this.translate(addr.start), this.translate(addr.end))
    return extrapolate.intersect(this.dest)
  }

  partialI(addr: Address): Link {
    const translated = this.translateI(addr)
    const untranslated = this.invert().translateI(translated)
    return translated ? new Link(untranslated, translated) : null
  }
}

class LinkSet {
  links: Link[]
  constructor(links: Link[]) {
    this.links = _.compact(links)
  }

  isEmpty(): boolean {
    return _.isEmpty(this.links)
  }

  toString(): string {
    return this.links.map(x => x.toString()).join('\n')
  }

  invert(): LinkSet {
    return new LinkSet(this.links.map(x => x.invert()))
  }

  image(addrs: Address[]): Address[] {
    return normalizeAddresses(_.compact(_.flatMap(this.links, link =>
      _.flatMap(addrs, addr => link.translateI(addr))
    )))
  }

  preimage(addrs: Address[]): Address[] {
    return this.invert().image(addrs)
  }

  domain(): Address[] {
    return normalizeAddresses(_.map(this.links, 'origin'))
  }

  range(): Address[] {
    return normalizeAddresses(_.map(this.links, 'dest'))
  }

  partial(addr: Address): LinkSet {
    const overlapping = this.links.filter(link => link.origin.intersect(addr))
    return new LinkSet(overlapping.map(link => link.partialI(addr)))
  }

  prism(otherLinkSet: LinkSet, addr: Address): LinkSet {
    const forwardLinks = this.partial(addr).links
    const backwardLinks = otherLinkSet.invert().partial(addr).links
    return new LinkSet(_.flatMap(forwardLinks, forward =>
      _.flatMap(backwardLinks, backward => new Link(backward.dest, forward.dest))
    ))
  }

  compose(otherLinkSet: LinkSet): LinkSet {
    const longI = otherLinkSet.image(this.range())
    const prelongs = otherLinkSet.preimage(longI)
    const shortI = diffAddresses(this.range(), prelongs)
    const preshorts = this.preimage(shortI)
    const shorts = _.flatMap(preshorts, addr => this.partial(addr).links)
    const longs = _.flatMap(prelongs, addr => otherLinkSet.prism(this, addr).links)
    return new LinkSet([...shorts, ...longs])
  }
}

type Direction = 'left' | 'right' | 'neither'
type Pair = [number, string]

class SplitString {
  id: string
  strs: string[]
  length: number
  constructor(strs: string[]) {
    this.id = _.uniqueId('edit-')
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

  insertChar(start: number, c: string, bias: Direction = 'left'): SplitString {
    const [pairs, startPair] = this.getPair(start, bias)
    const startIdx = pairs.indexOf(startPair)
    const [startOffset, startStr] = startPair
    if (bias === 'neither') {
      // the case when cursor is in a new, blank block
      return new SplitString([
        ...this.strs.slice(0, startIdx + 1),
        c,
        ...this.strs.slice(startIdx + 1),
      ])
    }
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
    // TODO: I believe this misses the case of spanning some intervening blocks
    return startStr.substr(start - startOffset) + endStr.substr(0, end - endOffset)
  }
}

type Content = {blocks: SplitString, links: LinkSet}

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
      ? { blocks: new SplitString(content.split('\n\n')), links: new LinkSet([]) }
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
        links: new LinkSet([]),
      }, this.root)
      newModel.content.links = new LinkSet([
        new Link(
          new Address(newModel.content, 0, sel.start - 1),
          new Address(this.content, 0, sel.start - 1)
        ),
        new Link(
          new Address(newModel.content, sel.start - 1, contentLength - 1),
          new Address(this.content, sel.start, contentLength)
        ),
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
      links: new LinkSet([]),
    }, this.root)
    newModel.content.links = new LinkSet([
      new Link(
        new Address(newModel.content, 0, contentLength),
        new Address(this.content, 0, contentLength)
      ),
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
      links: new LinkSet([]),
    }, this.root)
    newModel.content.links = new LinkSet([
      sel.start && new Link(
        new Address(newModel.content, 0, sel.start),
        new Address(this.content, 0, sel.start)
      ),
      sel.end !== contentLength && new Link(
        new Address(newModel.content, sel.start, contentLength - (sel.end - sel.start)),
        new Address(this.content, sel.end, contentLength)
      ),
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
      links: new LinkSet([]),
    }, this.root)
    newModel.content.links = new LinkSet([
      sel.start && new Link(
        new Address(newModel.content, 0, sel.start),
        new Address(this.content, 0, sel.start)
      ),
      sel.end !== contentLength && new Link(
        new Address(newModel.content, sel.start + 1, contentLength + 1),
        new Address(this.content, sel.start, contentLength)
      ),
    ])
    return newModel
  }

  insertReference(basis: Content, start: number, end: number): TOM {
    const article = this.root.querySelector('article')
    const j = new Jerry(article)
    const sel = j.getSelection()
    if (sel.start !== sel.end) {
      // TODO: implement insert/delete
      return this
    }

    const refText = basis.blocks.readRange(start, end)
    const contentLength = contentToStrings(this.content).length
    const newModel = new TOM({
      blocks: this.content.blocks.insertChar(sel.start, refText, sel.bias),
      links: new LinkSet([]),
    }, this.root)
    newModel.content.links = new LinkSet([
      sel.start && new Link(
        new Address(newModel.content, 0, sel.start),
        new Address(this.content, 0, sel.start)
      ),
      new Link(
        new Address(newModel.content, sel.start, sel.start + (end - start)),
        new Address(basis, start, end)
      ),
      sel.end !== contentLength && new Link(
        new Address(newModel.content, sel.start + refText.length, contentLength + refText.length),
        new Address(this.content, sel.start, contentLength)
      ),
    ])
    return newModel
  }
}

export function Tom({
  modelKey,
  models,
  title = '',
  links = [],
  onChange = null,
  immutable = false,
  setEditing = null,
  onClose = null,
  versionType = null,
  showVersions = null,
  showingVersions = false,
}) {
  const model = models.lookup[modelKey]
  if (immutable) {
    // TODO: this glitches for delete patch viewer because deletes pass data in sort of reversed
    const parentKey = models.order[models.order.indexOf(modelKey) - 1]
    const foreignLinks = model.content.links.links.filter(x => _.get(x, 'dest.basis.blocks.id') !== parentKey)
    return (
      <div
        className={cx(
          'page immutable',
          !onClose && 'basis',
          {'-': 'delete', '+': 'add'}[versionType]
        )}
        key="immutable"
        ref={ref => {
          if (ref && !ref.querySelector('article')) {
            model.render(ref)
            const article = ref.querySelector('article')
            article.setAttribute('contentEditable', false)
            links.forEach(x => {
              const addr = x.toJerry(article)
              addr.highlight()
            })
            foreignLinks.forEach(x => {
              const addr = x.origin.toJerry(article)
              const leafs = addr.toLeafs()
              console.log('addr for foreign link', leafs)
              const note = document.createElement('div')
              const articleRect = article.getBoundingClientRect()
              const leafRect = leafs[0].root.parentNode.getBoundingClientRect()
              console.log(articleRect, leafRect)
              note.classList.add('note')
              note.style.position = 'absolute'
              note.style.left = `${articleRect.left + articleRect.width + 10}px`
              note.style.top = `${leafRect.top}px`

              const banner = document.createElement('div')
              banner.classList.add('banner')
              const title = document.createElement('div')
              title.classList.add('title')
              const source = document.createElement('div')
              source.classList.add('source')
              source.innerText = x.dest.basis.blocks.id
              title.appendChild(source)
              banner.appendChild(title)
              const quote = document.createElement('div')
              quote.innerText = x.dest.basis.blocks.readRange(x.dest.start, x.dest.end)
              quote.classList.add('description')
              note.appendChild(quote)
              note.appendChild(banner)

              ref.appendChild(note)
            })
            article.addEventListener('copy', evt => {
              const article = ref.querySelector('article')
              if (!article) return
              const sel = new Jerry(article).getSelection()
              const content = sel.getContent()
              evt.clipboardData.setData('text/plain', content)
              evt.clipboardData.setData('jerry', modelKey + ':' + [sel.start, sel.end].join('-'))
              evt.preventDefault()
            })
          }
        }}
        onClick={() => setEditing && setEditing(true)}
      >
        <header>
          {showVersions && <div
            className={cx('action', showingVersions && 'active')}
            onClick={() => showVersions(x => !x)}
          >&#x2630;</div>}
          {onClose && (
            <div className="action" onClick={() => onClose()}>&times;</div>
          )}
          <h1>{title || <>&nbsp;</>}</h1>
          {onChange && <>
            <div className="action">&#x2197;</div>
            <div className="action">&#x2199;</div>
          </>}
        </header>
      </div>
    )
  }
  return (
    <div
      className='page'
      key="mutable"
      ref={ref => {
        if (ref && !ref.querySelector('article')) {
          model.render(ref)
          const article = ref.querySelector('article')
          article.addEventListener('paste', evt => {
            const data = evt.clipboardData.getData('jerry')
            if (!data) {
              evt.preventDefault()
              return
            }
            const [basisId, range] = data.split(':')
            const [start, end] = range.split('-').map(x => +x)
            const newModel = model.insertReference(models.lookup[basisId].content, start, end)
            onChange(newModel)
          })
        }
      }}
      onKeyDown={evt => {
        const specialKeys = {'Space': ' ', 'Period': '.', 'Minus': '-', 'Quote': '\''}
        if (evt.code === 'Backspace') {
          const isEmpty = model.emptySelection()
          if (!isEmpty) evt.preventDefault()
          const newModel = isEmpty ? model.backspace() : model.deleteSelection()
          onChange(newModel)
        } else if (evt.code.startsWith('Key') || specialKeys[evt.code]) {
          const key = specialKeys[evt.code] || evt.key
          const newModel = model.insertChar(key)
          onChange(newModel)
        } else if (evt.code === 'Escape') {
          if (setEditing) {
            setEditing(false)
            evt.preventDefault()
          }
        } else if (evt.code !== 'Enter') {
          evt.preventDefault()
        }
      }}
    >
      <header>
        <div
          className={cx('action', showingVersions && 'active')}
          onClick={() => showVersions(x => !x)}
        >&#x2630;</div>
        <h1>{title}</h1>
        <>
          <div className="action">&#x2197;</div>
          <div className="action">&#x2199;</div>
        </>
      </header>
    </div>
  )
}

function getHistory(content) {
  const basis = _.find(content.links.links, 'dest.basis')?.dest?.basis
  return [content, ...(basis ? getHistory(basis) : [])]
}

export default function App({content}) {
  const defaultModel = new TOM(content)
  const defaultKey = defaultModel.content.blocks.id

  const [models, setModels] = React.useState({
    lookup: {[defaultKey]: defaultModel},
    order: [defaultKey],
  })
  const [modelKey, setModelKey] = React.useState(defaultKey)
  const model = models.lookup[modelKey]
  const setModel = model => {
    const modelKey = model.content.blocks.id
    setModels({
      lookup: {...models.lookup, [modelKey]: model},
      order: [...models.order, modelKey],
    })
    setModelKey(modelKey)
  }

  const [editing, setEditing] = React.useState(true)
  const [showingVersions, setShowingVersions] = React.useState(true)
  const [comparisonVersion, setComparisonVersion] = React.useState(null)
  const history: Content[] = getHistory(model.content)
  const version = model.content.blocks.id
  const root = history.find(x => x.blocks.id === comparisonVersion)
  const rootParent = history[history.indexOf(root) + 1]
  const outboundLinks = root && rootParent && root.links.invert().partial(new Address(rootParent, 0, rootParent.blocks.length)).range()
  const versionType = root && (rootParent && root.blocks.length < rootParent.blocks.length ? '-' : '+')
  return (
    <div className='pages'>
      {showingVersions && <div className="versions">
        <header><h1>Versions</h1></header>
        <div className="column">
          {history.map((content, i) => {
            const prev = history[i + 1]
            const id = content.blocks.id
            const editType = prev && content.blocks.length < prev.blocks.length ? '-' : '+'
            return (
              <div
                className="version"
                onClick={() => setComparisonVersion(id)}
              >{id} ({editType})</div>
            )
          })}
        </div>
      </div>}
      {!comparisonVersion && <Tom
        title={`Man in Universe (latest)`}
        showVersions={setShowingVersions}
        showingVersions={showingVersions}
        modelKey={modelKey}
        models={models}
        onChange={m => {
          setModel(m)
        }}
        setEditing={setEditing}
        immutable={!editing || comparisonVersion}
        links={[]}
        key={`${editing}-${comparisonVersion}`}
      />}
      {comparisonVersion && (<Tom
          key={comparisonVersion}
          title={`Man in Universe (${comparisonVersion})`}
          modelKey={versionType === '-' && rootParent ? rootParent.blocks.id : root.blocks.id}
          models={models}
          links={versionType === '-' && rootParent ? root.links.invert().domain() : outboundLinks}
          onClose={() => setComparisonVersion(null)}
          versionType={versionType}
          immutable
        />)}
    </div>
  )
}
