import {createSlug, getDatabasesIfNeeded} from "../tools/file"
import {removeHidden} from "../tools/doc-contents"
import {LatexExporterConvert} from "./convert"
import {zipFileCreator} from "../tools/zip"
import {BibLatexExporter} from "biblatex-csl-converter"
/*
 Exporter to LaTeX
*/

export class LatexExporter {
    constructor(doc, bibDB, imageDB) {
        this.doc = doc
        this.bibDB = bibDB
        this.imageDB = imageDB
        this.docContents = false
        this.zipFileName = false
        this.textFiles = []
        this.httpFiles = []

        getDatabasesIfNeeded(this, doc).then(
            () => {
                this.init()
            }
        )
    }

    init() {
        this.zipFileName = `${createSlug(this.doc.title)}.latex.zip`
        this.docContents = removeHidden(this.doc.contents)
        this.converter = new LatexExporterConvert(this, this.imageDB, this.bibDB)
        this.conversion = this.converter.init(this.docContents)
        if (Object.keys(this.conversion.usedBibDB).length > 0) {
            let bibExport = new BibLatexExporter(this.conversion.usedBibDB)
            this.textFiles.push({filename: 'bibliography.bib', contents: bibExport.output})
        }
        this.textFiles.push({filename: 'document.tex', contents: this.conversion.latex})
        this.conversion.imageIds.forEach(
            id => {
                this.httpFiles.push({
                    filename: this.imageDB.db[id].image.split('/').pop(),
                    url: this.imageDB.db[id].image
                })
            }
        )

        zipFileCreator(this.textFiles, this.httpFiles, this.zipFileName)
    }



}
