import {createSlug} from "../tools/file"
import {zipFileCreator} from "../tools/zip"
import {BibliographyDB} from "../../bibliography/database"
import {ImageDB} from "../../images/database"
import {addAlert} from "../../common/common"
/** The current Fidus Writer filetype version.
 * The importer will not import from a higher version and the exporter
  * will include this number in all exports.
 */
export let FW_FILETYPE_VERSION = "1.6"

/** Create a Fidus Writer document and upload it to the server as a backup.
 * @function uploadNative
 * @param aDocument The document to turn into a Fidus Writer document and upload.
 */
export let uploadNative = function(editor) {
    exportNative(
        editor.doc,
        editor.imageDB.db,
        editor.bibDB.db,
        (doc, shrunkImageDB, shrunkBibDB, images) =>
            exportNativeFile(editor.doc, shrunkImageDB, shrunkBibDB, images, true, editor)
    )
}

export class NativeExporter {
    constructor(doc, bibDB, imageDB) {
        this.doc = doc
        this.bibDB = bibDB
        this.imageDB = imageDB
        this.init()
    }

    init() {
        this.getBibDB(
            () => {
                this.getImageDB(
                    () => {
                        exportNative(this.doc, this.imageDB, this.bibDB.db, exportNativeFile)
                    }
                )
            }
        )
    }

    getBibDB(callback) {
        if (!this.bibDB) {
            this.bibDB = new BibliographyDB(this.doc.owner.id, false, false, false)
            this.bibDB.getDB(() => callback())
        } else {
            callback()
        }
    }

    getImageDB(callback) {
        if (!this.imageDB) {
            let imageGetter = new ImageDB(this.doc.owner.id)
            imageGetter.getDB(
                () => {
                    this.imageDB = imageGetter.db
                    callback()
                }
            )
        } else {
            callback()
        }
    }
}

// used in copy
export let exportNative = function(doc, anImageDB, aBibDB, callback) {
    let shrunkImageDB = {},
        httpIncludes = []

    addAlert('info', gettext('File export has been initiated.'))

    let imageList = [], citeList = []

    function walkTree(node) {
        switch (node.type) {
            case 'citation':
                citeList = citeList.concat(node.attrs.references.map(ref => ref.id))
                break
            case 'figure':
                if (node.attrs.image !== false) {
                    imageList.push(node.attrs.image)
                }
                break
            case 'footnote':
                if (node.attrs && node.attrs.footnote) {
                    node.attrs.footnote.forEach(childNode => walkTree(childNode))
                }
                break
        }
        if (node.content) {
            node.content.forEach(childNode => walkTree(childNode))
        }
    }

    walkTree(doc.contents)

    imageList = _.uniq(imageList)

    imageList.forEach(itemId => {
        shrunkImageDB[itemId] = Object.assign({}, anImageDB[itemId])
        // Remove parts that are connected to a particular user/server
        delete shrunkImageDB[itemId].cats
        delete shrunkImageDB[itemId].thumbnail
        delete shrunkImageDB[itemId].pk
        delete shrunkImageDB[itemId].added
        let imageUrl = shrunkImageDB[itemId].image
        let filename = imageUrl.split('/').pop()
        shrunkImageDB[itemId].image = filename
        httpIncludes.push({
            url: imageUrl,
            filename: filename
        })
    })

    citeList = _.uniq(citeList)

    let shrunkBibDB = {}
    citeList.forEach(itemId => {
        shrunkBibDB[itemId] = Object.assign({}, aBibDB[itemId])
        // Remove the entry_cat, as it is only a list of IDs for one
        // particular user/server.
        delete shrunkBibDB[itemId].entry_cat
    })

    let docCopy = Object.assign({}, doc)

    // Remove items that aren't needed.
    delete(docCopy.comment_version)
    delete(docCopy.access_rights)
    delete(docCopy.version)
    delete(docCopy.owner)
    delete(docCopy.id)

    callback(docCopy, shrunkImageDB, shrunkBibDB, httpIncludes)
}

let exportNativeFile = function(doc, shrunkImageDB,
    shrunkBibDB, images, upload = false, editor = false) {

    let httpOutputList = images

    let outputList = [{
        filename: 'document.json',
        contents: JSON.stringify(doc),
    }, {
        filename: 'images.json',
        contents: JSON.stringify(shrunkImageDB)
    }, {
        filename: 'bibliography.json',
        contents: JSON.stringify(shrunkBibDB)
    }, {
        filename: 'filetype-version',
        contents: FW_FILETYPE_VERSION
    }]

    zipFileCreator(outputList, httpOutputList, createSlug(
            doc.title) +
        '.fidus', 'application/fidus+zip', false, upload, editor)
}
