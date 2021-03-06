import JSZip from "jszip"
import JSZipUtils from "jszip-utils"
import {downloadFile} from "./file"
// Handle a zip file containing XML files. Make sure files are only opened once,
// and provide a mechanism to save the file.

export class XmlZip {
    constructor(fileName, url) {
        this.fileName = fileName
        this.url = url
        this.zip = new JSZip()
        this.docs = {}
        this.extraFiles = {}
        this.rawFile = false
    }

    init() {
        return this.downloadZip().then(() => this.loadZip())
    }

    downloadZip() {
        return new Promise(resolve => {
            JSZipUtils.getBinaryContent(
                this.url,
                (err, rawFile) => {
                    this.rawFile = rawFile
                    resolve()
                }
            )
        })
    }

    loadZip() {
        return this.zip.loadAsync(this.rawFile)
    }

    // Open file at filePath from zip file and parse it as XML.
    getXml(filePath, defaultContents) {
        if (this.docs[filePath]) {
            // file has been loaded already.
            return Promise.resolve(this.docs[filePath])
        } else if (this.zip.files[filePath]) {
            return this.zip.file(filePath).async('string').then(
                string => {
                    const parser = new window.DOMParser()
                    this.docs[filePath] = parser.parseFromString(string, "text/xml")
                    return Promise.resolve(this.docs[filePath])
                }
            )
        } else if (defaultContents) {
            return Promise.resolve(defaultContents).then(
                string => {
                    const parser = new window.DOMParser()
                    this.docs[filePath] = parser.parseFromString(string, "text/xml")
                    return Promise.resolve(this.docs[filePath])
                }
            )
        } else {
            // File couldn't be found and there was no default value.
            return Promise.reject("File not found")
        }

    }

    // Add an xml file at filepath without checking for previous version
    addXmlFile(filePath, xmlContents) {
        this.docs[filePath] = xmlContents
    }

    // Add extra file to be saved in zip later.
    addExtraFile(filePath, fileContents) {
        this.extraFiles[filePath] = fileContents
    }

    // Put all currently open XML files into zip.
    allXMLToZip() {
        for (let fileName in this.docs) {
            this.xmlToZip(fileName)
        }
    }

    // Put all extra files into zip.
    allExtraToZip() {
        for (let fileName in this.extraFiles) {
            this.zip.file(fileName, this.extraFiles[fileName])
        }
    }


    // Put the xml identified by filePath into zip.
    xmlToZip(filePath) {
        const serializer = new window.XMLSerializer()
        const string = serializer.serializeToString(this.docs[filePath])
        this.zip.file(filePath, string)
    }

    prepareAndDownload() {
        this.allXMLToZip()
        this.allExtraToZip()

        this.zip.generateAsync({type:"blob"}).then(out => downloadFile(this.fileName, out))
    }

}
