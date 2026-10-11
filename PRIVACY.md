# Privacy

Helium New Tab stores appearance, language, clock, font, and service-icon preferences, and the
addresses and names of sites you pin, in local storage within your browser profile. It also
copies them, except the service-icon choice, to the browser's extension sync storage. If your
browser syncs extension data through your browser account, those preferences and pinned sites
follow you to your other devices; otherwise they stay on this device. Each saved copy also notes when it changed and a random identifier for the device
that changed it, so a device can tell its own older changes from newer ones. The identifier is
created on the device and identifies nothing else. It has no account, analytics, advertising,
telemetry, or backend. It does not transmit browsing history. The optional most-visited shortcuts read only the browser-provided top-sites list after you grant permission.

The extension makes no automatic external network requests. Translations, the Instrument Sans Variable font, artwork, scripts, and styles ship in the extension; other custom fonts must already be installed on your device.

Custom background images are stored as files in the extension's local IndexedDB database. They are not uploaded or synced. Removing a background deletes that stored image.

**Shortcuts → Most visited** requests the optional `topSites` permission and reads the browser's ranked list of most-visited pages. It does not read the full history or count individual visits. The list stays in memory and is not synced or sent to a server. This mode is a per-device preference; your manual shortcuts are kept separately. Removing the permission returns to manual shortcuts.

When you choose an image with the Lens button or drop an image onto the page, the extension submits that image directly to Google Lens for visual search. The hint and drop target identify Google as the recipient. It does not keep a copy. Google handles the image under [its privacy policy](https://policies.google.com/privacy). Selecting an image in the custom-background settings only stores it locally and does not submit it to Lens.

**Customize → Show service icons** is off by default. Turning it on asks for the optional
`favicon` permission, which lets the extension read site icons your browser has already
saved. While you type a recognized bang, the extension looks up the destination's icon in
that local cache, and pinned sites show their icons from it. No icon service or website receives
a request. Bangs with query-dependent hostnames show no icon.

The bang catalog ships with the extension. Maintainers update this snapshot manually
with extension releases. The extension does not download or cache bang catalogs.

When you submit a search, the extension passes your query to the browser's configured
search provider through the `search` permission. Recognized bangs, such as `!yt`, are
resolved using the local catalog and navigate directly to the destination with your
search terms. No external bang lookup or redirect service receives those queries.
Unknown bangs are passed to your configured search provider. Entering a website address
navigates to that website. Those destinations have their own privacy policies. The development
preview uses DuckDuckGo because it does not have access to the browser search API.

Uninstalling the extension removes its stored preferences. To report a privacy concern,
[open an issue](https://github.com/exsesx/helium-new-tab/issues) without including private data.
