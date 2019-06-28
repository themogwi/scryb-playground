const fs = require('fs')
const axios = require('axios')
const slugify = require('slugify')
const pdf = require('pdfkit')

const toPixels = (inches) => {
    return inches * 72
}

const getCards = (url, cards, resolve, reject) => {
    axios.get(url)
        .then(response => {
            const retrivedCards = cards.concat(response.data.data)
            if (response.data.has_more === true) {
                getCards(response.data.next_page, retrivedCards, resolve, reject)
            } else {
                resolve(retrivedCards)
            }
        })
        .catch(error => {
            console.log(error)
            reject('Something went wrong while fetching the list of cards.')
        })
}

const download = async () => {
    new Promise((resolve, reject) => {
        getCards('https://api.scryfall.com/cards/search?q=cube:vintage', [], resolve, reject)
    })
        .then(async response => {{
            for (let i = 0; i < response.length; i++) {
                const card = response[i]
                let path = 'cards/' + slugify(card.name) + '.front.png'
                let url = (card.image_uris || (card.card_faces && card.card_faces[0].image_uris)).png
                console.log(`Downloading card front for ${card.name}...`)
                await axios({
                    url,
                    responseType: 'stream',
                }).then(
                    response =>
                        new Promise((resolve, reject) => {
                            response.data
                            .pipe(fs.createWriteStream(path))
                            .on('finish', () => resolve())
                            .on('error', e => reject(e))
                        }),
                )
                if (card.layout === 'transform') {
                    let path = 'cards/' + slugify(card.name) + '.back.png'
                    let url = card.card_faces[1].image_uris.png
                    console.log(`Downloading card back for ${card.name}...`)
                    await axios({
                        url,
                        responseType: 'stream',
                    }).then(
                        response =>
                            new Promise((resolve, reject) => {
                                response.data
                                .pipe(fs.createWriteStream(path))
                                .on('finish', () => resolve())
                                .on('error', e => reject(e))
                            }),
                    )
                }
            }
        }})
}

const createPdf = async () => {

    const drawLines = () => {
        const horiLines = rowsPerPage * 2
        const vertLines = cardsPerRow * 2

        let xLoc = spacing
        let yLoc = spacing

        doc.lineWidth(1)
        doc.fillColor('#ffffff')
        doc.strokeColor('#ffffff')

        for (let i = 0; i < horiLines; i++) {
            doc.moveTo(0, yLoc).lineTo(pageWidth, yLoc).stroke()
            if (i % 2 === 0) {
                yLoc += cardHeight
            } else {
                yLoc += spacing
            }
        }

        for (let i = 0; i < vertLines; i++) {
            doc.moveTo(xLoc, 0).lineTo(xLoc, pageHeight).stroke()
            if (i % 2 === 0) {
                xLoc += cardWidth
            } else {
                xLoc += spacing
            }
        }
    }

    let cards = JSON.parse(fs.readFileSync('vintage-cube.json'))

    const pageHeight = toPixels(12)
    const pageWidth = toPixels(18)
    const cardWidth = toPixels(2.5)
    const cardHeight = toPixels(3.5)
    const spacing = toPixels(.4)
    const rowsPerPage = 3
    const cardsPerRow = 6
    const cardsPerPage = 18
    const pages = (Math.ceil(cards.length / cardsPerPage) * 2) - 1
    let current = 0

    const doc = new pdf({
        layout: 'landscape',
        size: [
            pageHeight,
            pageWidth
        ],
        margin: 0,
        bufferPages: true
    })

    doc.pipe(fs.createWriteStream('output.pdf'))

    doc.on('pageAdded', () => {
        doc.rect(0, 0, pageWidth, pageHeight).fill('#000000')
        drawLines(doc)
    })

    doc.rect(0, 0, pageWidth, pageHeight).fill('#000000')
    drawLines(doc)

    for (let i = 0; i < pages; i++) {
        doc.addPage()
    }

    doc.switchToPage(current)

    let x = y = spacing

    for (let i = 0; i < cards.length; i++) {
        const card = cards[i]
        let path = 'cards/' + slugify(card.name) + '.front.png'
        doc.image(path, x, y, {
            width: cardWidth,
            height: cardHeight
        })
        x += cardWidth + spacing
        if ((i + 1) % cardsPerRow === 0) {
            y += cardHeight + spacing
            x = spacing
        }
        if ((i + 1) % cardsPerPage === 0) {
            current += 2
            x = spacing
            y = spacing
            if (current <= pages) {
                doc.switchToPage(current)
            }
        }
    }

    x = spacing
    y = spacing
    current = 1
    doc.switchToPage(current)

    for (let i = 0; i < cards.length; i++) {
        const card = cards[i]
        let path = 'card-back.jpg'
        if (card.layout == 'transform') {
            path = 'cards/' + slugify(card.name) + '.back.png'
        }
        doc.image(path, x, y, {
            width: cardWidth,
            height: cardHeight

        })
        x += cardWidth + spacing
        if ((i + 1) % 6 === 0) {
            y += cardHeight + spacing
            x = spacing
        }
        if ((i + 1) % 18 === 0) {
            current += 2
            x = spacing
            y = spacing
            if (current <= pages) {
                doc.switchToPage(current)
            }
        }
    }

    doc.end()
}

createPdf()
// download()
