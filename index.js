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
    new Promise((resolve, reject) => {
        getCards('https://api.scryfall.com/cards/search?q=cube:vintage', [], resolve, reject)
    })
        .then(async response => {{
            const doc = new pdf({
                layout: 'landscape',
                size: [
                    toPixels(12),
                    toPixels(18)
                ],
                margin: 0
            })
            doc.pipe(fs.createWriteStream('output.pdf'))

            doc.rect(0, 0, toPixels(18), toPixels(12)).fill('#000000')

            let x = y = toPixels(.4)

            for (let i = 0; i < response.length - 516; i++) {
                const card = response[i]
                let path = 'cards/' + slugify(card.name) + '.front.png'
                // let img = 'data:image/png;base64,'+ Base64.encode(path)
                doc.image(path, x, y, {
                    width: toPixels(2.5),
                    height: toPixels(3.5),
                    align: 'left'

                })
                x += toPixels(2.5 + .4)
                if ((i + 1) % 6 === 0) {
                    y += toPixels(3.5 + .4)
                    x = toPixels(.4)
                }
                // if ((i + 1) % 18 === 0) {
                //     doc.addPage()
                //     doc.rect(0, 0, toPixels(18), toPixels(12)).fill('#000000')
                //     x = toPixels(.4)
                //     y = toPixels(.4)
                // }
            }
            doc.end()
        }})
}

createPdf()
