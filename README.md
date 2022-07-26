# TOM

<img src="tom.png" width="200px" />

Text Organization Model -- a content-editable React component and novel
representation structure built with [jerry](http://github.com/mattneary/jerry).
Text edits are tracked in revisions. In this representation scheme, unchanged
segments of text are linked to their counterpart in the previous version.

## usage

```javascript
<Tom model={model: TOM} onChange={(model: TOM) => any} />
```
