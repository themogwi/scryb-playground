const fs = require('fs')
const axios = require('axios')
const slugify = require('slugify')
const pdf = require('pdfkit')

const imgSizes = {
    png: {
        key: 'png',
        ext: 'png'
    },
    normal: {
        key: 'normal',
        ext: 'jpg'
    },
    border_crop: {
        key: 'border_crop',
        ext: 'jpg'
    }
}

/**
 * Set to scryfall imagery size needed
 */
const imgSize = imgSizes.png


const toPixels = (inches) => {
    return inches * 72
}

const getList = () => {
    const filename = process.argv[3]
    return fs.readFileSync(filename, 'utf-8')
        .split('\n')
        .filter(Boolean)
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
    new Promise( async (resolve, reject) => {
        const list = getList()
        let cards = []
        let output = []

        for (let i = 0; i < list.length; i++) {
            const line = list[i]
            let quantity = line.substr(0, line.indexOf(' '))
            let name = false
            let set = false
            let url = false

            if (line.includes('[')) {
                name = line.substr(line.indexOf('] ')+2)
                set = line.substring(line.indexOf('[')+1, line.indexOf(':'))
                url = `https://api.scryfall.com/cards/named?set=${set.toLowerCase()}&exact="${name}"`
            } else {
                name = line.substr(line.indexOf(' ')+1)
                url = `https://api.scryfall.com/cards/named?exact="${name}"`
            }

            console.log(`Retrieving "${name}" from scryfall... \t ${url}`)

            let card = await axios.get(url)
                .then(response => {
                    return response.data
                })
                .catch(error => {
                    console.log(error)
                    reject(`Something went wrong while fetching the single card... ${url}`)
                })

            cards.push(card)
            for (let i = quantity; i !== 0; i--) {
                output.push(card)
            }
        }

        await fs.writeFile('lists/list.json', JSON.stringify(output), (err) => {
            if (err) {
                console.error(err)
                return
            }
            console.log('Created list.json!')
        })

        resolve(cards)
    })
        .then(async response => {{
            for (let i = 0; i < response.length; i++) {
                const card = response[i]
                let path = `cards/${imgSize.key}/`
                let filename = `${slugify(card.name)}.front.${imgSize.ext}`
                let url = (card.image_uris || (card.card_faces && card.card_faces[0].image_uris))[imgSize.key]
                console.log(`Downloading card front for "${card.name}"...`)
                await axios({
                    url,
                    responseType: 'stream',
                }).then(
                    response =>
                        new Promise((resolve, reject) => {
                            response.data
                            .pipe(fs.createWriteStream(path + filename))
                            .on('finish', () => resolve())
                            .on('error', e => reject(e))
                        }),
                )
                if (card.layout === 'transform') {
                    let filename = `${slugify(card.name)}.back.${imgSize.ext}`
                    let url = card.card_faces[1].image_uris[imgSize.key]
                    console.log(`Downloading card back for ${card.name}...`)
                    await axios({
                        url,
                        responseType: 'stream',
                    }).then(
                        response =>
                            new Promise((resolve, reject) => {
                                response.data
                                .pipe(fs.createWriteStream(path + filename))
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
        const horiLines = rowsPerPage
        const vertLines = cardsPerRow

        let x = spacing + (cardWidth / 2)
        let y = spacing + (cardHeight / 2)

        doc.lineWidth(cardHeight)
        doc.fillColor('#000000')
        doc.strokeColor('#000000')

        for (let i = 0; i < horiLines; i++) {
            doc.moveTo(0, y).lineTo(pageWidth, y).stroke()
            y += spacing + cardHeight
        }

        doc.lineWidth(cardWidth)

        for (let i = 0; i < vertLines; i++) {
            doc.moveTo(x, 0).lineTo(x, pageHeight).stroke()
            x += spacing + cardWidth
        }
    }

    let cards = JSON.parse(fs.readFileSync('lists/list.json'))

    const includeBacks = true
    const pageHeight = toPixels(12)
    const pageWidth = toPixels(18)
    const cardWidth = toPixels(2.48)
    const cardHeight = toPixels(3.46)
    const rowsPerPage = 3
    const cardsPerRow = 6
    const cardsPerPage = 18
    const spacing = (pageWidth - cardWidth * cardsPerRow) / (cardsPerRow + 1)
    const pages = (Math.ceil(cards.length / cardsPerPage) * (includeBacks ? 2 : 1)) - 1

    // Need to start card backs from the opposite side
    const backStartX = pageWidth - (pageWidth - (cardWidth + spacing) * cardsPerRow) - cardWidth

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

    doc.pipe(fs.createWriteStream(`output-${imgSize.key}.pdf`))

    doc.on('pageAdded', () => {
        drawLines(doc)
    })

    drawLines(doc)

    for (let i = 0; i < pages; i++) {
        doc.addPage()
    }

    doc.switchToPage(current)

    let x = y = spacing

    for (let i = 0; i < cards.length; i++) {
        const card = cards[i]
        let path = `cards/${imgSize.key}/${slugify(card.name)}.front.${imgSize.ext}`
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
            current += includeBacks ? 2 : 1
            x = spacing
            y = spacing
            if (current <= pages) {
                doc.switchToPage(current)
            }
        }
    }

    if (includeBacks) {
        x = backStartX
        y = spacing
        current = 1
        doc.switchToPage(current)

        for (let i = 0; i < cards.length; i++) {
            const card = cards[i]
            let path = 'card-back.jpg'
            if (card.layout == 'transform') {
                path = `cards/${imgSize.key}/${slugify(card.name)}.back.${imgSize.ext}`
            }
            doc.image(path, x, y, {
                width: cardWidth,
                height: cardHeight

            })
            x -= (cardWidth + spacing)
            if ((i + 1) % 6 === 0) {
                y += cardHeight + spacing
                x = backStartX
            }
            if ((i + 1) % 18 === 0) {
                current += 2
                x = backStartX
                y = spacing
                if (current <= pages) {
                    doc.switchToPage(current)
                }
            }
        }
    }

    doc.end()
}


const action = process.argv[2]

if (action === 'download') {
    download()
}

if (action === 'pdf') {
    createPdf()
}
