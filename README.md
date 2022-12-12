# TOM
*Text Object Model — a rich text editor for React built on a novel
representation structure powered by [jerry](http://github.com/mattneary/jerry).*

<img src="tom.png" width="200px" />

Like the DOM, TOM represents the structure of a webpage. However, it has two
idiosyncrasies that set it apart:

- First, TOM stores links outside of the flow of a page's node list. This means
that links are represented as annotations rather than as a type of node. For
the sake of clarity, we will refer to TOM-style links as *ribbons*. For the same
reason, we'll call TOM-style nodes *buds*.

- Second, TOM allows for a degree of nested structure, but it's more limited
than the DOM in this regard. Where the DOM consists of a hierarchy of nodes
within nodes, a TOM page only accepts two types of buds. TOM buds are either
TextBuds or RefBuds—where RefBuds are used to transclude fragments, URLs or
other TOM pages that are stored as ribbon attachments. In this way, TOM pages
still have recursive structure, but in a narrower sense. To make page
transclusion possible, the TOM renderer must be given a lookup function that
will return the data for a page given its id.

TOM will be a more useful representation structure than the DOM in a variety of
cases.

- For one, it's easier to make content-editable since it supports only a
subset of the DOM's hierarchical structure.

- It's also better for rendering a specific type of content in which pages are
transcluded in other pages. Think of a blogpost with embedded tweets or an
essay with an image gallery in-lined for examples of what this will tend look
like.

- Finally, this representation of pages unlocks a powerful kind of version
control.  Ribbons are used to represent the transformations of
content—what's preserved, added, and removed from one revision to the next.
This is more significant than it may sound: your average web editor doesn't
make it easy to brainstorm, iterate, and turn comments on posts. With
TOM, all of these processes become much easier.

On top of the basic structure of ribbons and buds, we overlay editor
functionality that makes high-level editing operations super easy.  Copy and
paste are an important part of the workflow, and these operations have
comprehensive support in TOM.  But we add a set of related operations in
addition to these more conventional ones. There's key commands for elide (`.`),
punch out (`>`), stack (`|`) as well as their counterparts
expand/pull in/unstack. These toggles manipulate the buds and ribbons of a
page in interesting ways: elide moves selected text into a ribbon and replaces
it with "...", punch out creates a new page and a corresponding RefBud from a
selection, and stack gathers selected buds as attachments to a RefBud. Elide also
enables more general behavior: for example, a URL and the text fragment to which it
is connected can be swapped, the URL edited, and then the pair swapped back to
its original configuration.

## usage

```typescript
type Page = {
  id: string
  buds: Bud[]
  connections: Ribbon[]
  sources: Ribbon[]
}

type Bud = TextBud | RefBud
type TextBud = {type: 'text', content: string}
type DisplayMode = 'bud' | 'card' | 'quote'
type RefBud = {type: 'ref', displayMode: DisplayMode}

type Ribbon = {
  origin: Interval
  dest: Interval
  displayMode: string
}
type Interval = {pageId: string, startIdx: number, endIdx: number}
```

```typescript
<Tom
  currentPageId={id: string}
  pushPage={(id: string, page: Page) -> void}
  getPage={(id: string) -> Page}
  contentEditable={boolean}
/>
```
