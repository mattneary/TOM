import React from 'react'
import _ from 'lodash'
import Jerry, {Address} from 'jerrymander'
import './main.scss'

function reactToDom(r) {
  if (_.isString(r)) return document.createTextNode(r)
  const elm = document.createElement(r.type)
  const children = _.isArray(r.props.children) ? r.props.children : [r.props.children]
  const otherProps = _.omit(r.props, 'children')
  _.keys(otherProps).forEach(prop => elm.setAttribute(prop, otherProps[prop]))
  children.forEach(c => elm.appendChild(reactToDom(c)))
  return elm
}

type Entry = {type: 'entry', content: string, length: number}
type Link = {type: 'link', start: number, length: number, basis: Content}
type Block = {items: (Entry | Link)[]}
type Content = Block[]

function linkText(link: Link): string {
  return flatContent(link.basis).substr(link.start, link.length)
}

function flatContent(content: Content): string {
  return content.map(({items}) => {
    return items.map(item => {
      if (item.type === 'link') {
        return linkText(item)
      } else if (item.type === 'entry') {
        return item.content
      }
    }).join('')
  }).join('')
}

function contentToHtml(content: Content): Element {
  const article = document.createElement('article')
  content.forEach(({items}) => {
    const p = document.createElement('p')
    items.forEach(item => {
      if (item.type === 'entry') {
        p.appendChild(document.createTextNode(item.content))
      } else if (item.type === 'link') {
        p.appendChild(document.createTextNode(linkText(item)))
      }
    })
    article.appendChild(p)
  })
  article.setAttribute('contentEditable', 'true')
  return article
}

const TEXT_CONTENT = `
Man, as we know him, is a comparative late-comer in the history of the Earth and tenuous film of life which its surface has supported. In certain respects he is one of the most fragile of living creatures—yet, in the manner of his explosive appearance on the scene, and the ways in which he has profoundly altered the environment within which he developed, he is the most powerful organism to have emerged so far.

This ‘power’ to which we will often refer, (and indeed upon which this entire report is a commentary) is not visible physical power, but rather the wholly invisible power of the brain. Linnaeus, the eminent Swedish botanist, first gave the name *homo sapiens* to our present human strain. The wisdom (or “sapien”) referred to is not so developed in the traditional sense as we might desire, but as intellect or brain power it is awesomely demonstrable.

Yet the difference between man and other organisms seems still only a matter of degree—of relative weight of brain, perhaps, and the number of its surface convolutions—but it is a marginal difference which is sufficient to alter significantly the way in which man has so far evolved. This difference has served to provide two main characteristics which set him apart from all other creatures. One is the ability to transmit his consciously accumulated knowledge from one generation to another and across many generations, and the other to externalise his organic functions into extent fabricated from his material environment—his tools. These features, combined, have enabled man, in spite of his relatively puny physical stature, to adapt himself to his environment so that he has been able to survive severe climatic and other changes, and to spread swiftly out into every corner of the Earth.

His capacity to transcend the temporal limits of his own life span by communicating his thought and feelings through many generations has given him an unique ‘continuous’ quality. Though his physical body may be entirely changed through cell renewal many times in his life and eventually be dissolved into its constituent parts. In the sense referred to even the individual may be ‘continuous’, and the overlapping and interweaving of generations of communicating individuals make man, potentially, an organism which never sleeps, dies, or forgets …
`

const content: Content = TEXT_CONTENT.split('\n\n').map(x => ({
  items: [{type: 'entry', content: x.trim(), length: x.length}],
}))

function mergeElms(a: Element, b: Element) {
  Array.from(b.childNodes).forEach(child => a.appendChild(child))
  b.parentNode.removeChild(b)
}

class TOM {
  root: Element
  content: Content

  constructor(content: Content, node: Element) {
    this.root = node
    this.content = content
  }

  render() {
    this.root.appendChild(contentToHtml(this.content))
  }

  deleteSelection() {
    const article = this.root.querySelector('article')
    const sel = new Jerry(article).getSelection()
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

    const contentLength = flatContent(this.content).length
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

export default function Tom() {
  const tomRef = React.useRef()
  const [contentRepr, setContentRepr] = React.useState(null)
  console.log(contentRepr)
  return (
    <div className='pages'>
      <div className='page' ref={ref => {
        if (ref && !tomRef.current) {
          tomRef.current = new TOM(content, ref)
          setContentRepr(content)
          tomRef.current.render()
        }
      }}>
        <header>
          <div className='headline'>
            <h1>Man in Universe</h1>
            <button
              onClick={evt => {
                tomRef.current.deleteSelection()
                setContentRepr(tomRef.current.content)
              }}
            >Delete Selection</button>
          </div>
          <div className='byline'>Richard Buckminster Fuller, 1963</div>
        </header>
      </div>
      <div className='page'>
        <header>
          <div className='headline'>
            <h1>Man in Universe</h1>
          </div>
          <div className='byline'>Richard Buckminster Fuller, 1963</div>
          <article>
            {contentRepr && <p>{flatContent(contentRepr)}</p>}
          </article>
        </header>
      </div>
    </div>
  )
}
