# TOM

<img src="tom.png" width="200px" />

Text Object Model -- a rich text editor for React built on a novel
representation structure powered by [jerry](http://github.com/mattneary/jerry).

Like the DOM, TOM represents the structure of a webpage. However, it has two
idiosyncrasies that set it apart. First, TOM stores links outside of the flow
of a page's node list. This means that links are represented as annotations
rather than as a type of node. For the sake of clarity, we will refer to
TOM-style links as ribbons. For the same reason, we'll call TOM-style nodes
buds. Second, TOM allows for a degree of nested structure, but it's more
limited than the DOM in this regard. Where the DOM consists of a hierarchy of
nodes within nodes, a TOM page only accepts three types of buds. TOM buds are
either TextBuds, RefBuds, or Branches---where RefBuds are used to transclude
URLs or other TOM pages, and Branches display a set of buds in parallel. In
this way, TOM pages still have recursive structure, but in a narrower sense. To
make page translcusion possible, the TOM renderer must be given a lookup
function that will return the data for a page given its id.

TOM will be a more useful representation structure than the DOM in a variety of
cases. For one, it's easier to make content-editable since it supports only a
subset of the DOM's hierarchical structure. It's also better for rendering a
specific type of content in which pages are transcluded in other pages. Think
of a blogpost with embedded tweets or an essay with images interweaved with the
text for examples of what this will tend look like. Finally, this representation
of pages unlocks a powerful kind of version control.  Ribbons are used to
represent the transformations of content---what's preserved, added, and removed
from one revision to the next.

On top of this basic structure, we overlay additional functionality that makes
ribbons and branches accessible when editing content. Copy and paste are one
way that ribbons are created, as are normal edit operations---as mentioned
above.  In addition, there's toggles for elide (`.`), punch out (`>`), stack
(`|`), and split (`&`) as well as their counterparts expand/pull
in/unstack/join. These toggles manipulate the nodes and ribbons of a page in
interesting ways: elide moves selected text into a ribbon and replaces it with
"...", punch out creates a new page and a corresponding RefBud from a
selection, stack creates a branch from selected buds, and split turns a branch
into a single bud with its siblings pushed out into a ribbon. 

## usage

```javascript
type Page = {
  id: string
  buds: Bud[]
  ribbons: Ribbon[]
}

type Bud = TextBud | RefBud | Branch
type TextBud = {content: string}
type DisplayMode = 'bud' | 'card' | 'quote'
type RefBud = {src: string, displayMode: DisplayMode}
type Branch = {buds: Bud[], displayMode: DisplayMode}

type Ribbon = {
  origin: Interval
  dest: Interval
  displayMode: string
}
type Interval = {pageId: string, startIdx: number, endIdx: number}
```

```javascript
<Tom
  currentPageId={id: string}
  pushPage={(id: string, page: Page) -> void}
  getPage={(id: string) -> Page}
  contentEditable={boolean}
/>
```
