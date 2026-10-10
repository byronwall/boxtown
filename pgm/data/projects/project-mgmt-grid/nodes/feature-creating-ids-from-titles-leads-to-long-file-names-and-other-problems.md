---
id: feature-creating-ids-from-titles-leads-to-long-file-names-and-other-problems
label: Creating ids from titles leads to long file names and other problems
type: task
status: implemented
archived: true
metadata:
  implementation: Merged in https://github.com/byronwall/prod-mgmt-grid/pull/2 (needs deploy to take effect).
---
Probably need to truncate or slugify differently

```
_projectId_-nCtAyM_h.js:45 [spatial-map-images] upload failed 
Object
error
: 
Error: ENAMETOOLONG: name too long, mkdir '/app/data/projects/image-annotation-real/images/page-getting-an-empty-text-box-on-a-dead-click-after-creating-text-should-remove-empty-text-boxes-dead-click-after-a-text-entry-should-deselect-not-create-more-text-dead-click-after-an-empty-text-input-should-also-remove-that-text-input-don-t-keep-a-blank-one-around' at async mkdir (node:internal/fs/promises:858:10) at async bt (file:///app/.output/server/chunks/build/data.server-DK-0cu5i.mjs:444:3) at async Object.Oa$1 [as handler] (file:///app/.output/server/chunks/nitro/nitro.mjs:15211:13) at async file:///app/.output/server/chunks/nitro/nitro.mjs:1828:19 at async Object.callAsync (file:///app/.output/server/chunks/nitro/nitro.mjs:4308:16) at async Server.toNodeHandle (file:///app/.output/server/chunks/nitro/nitro.mjs:2099:7)
nodeId
: 
"page-getting-an-empty-text-box-on-a-dead-click-after-creating-text-should-remove-empty-text-boxes-dead-click-after-a-text-entry-should-deselect-not-create-more-text-dead-click-after-an-empty-text-input-should-also-remove-that-text-input-don-t-keep-a-blank-one-around"
uploadedFiles
: 
[{…}]
```
