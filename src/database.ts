import { MongoClient } from "mongodb"
import { DatabaseInterface } from "./DatabaseInterface"
import { Quote } from "./Quote"

const host = process.env.DB_HOST
const port = process.env.DB_PORT
const user = process.env.DB_USER
const pass = process.env.DB_PASS
const name = process.env.DB_NAME

if (host === undefined) throw "Expected DB_HOST"
if (port === undefined) throw "Expected DB_PORT"
if (user === undefined) throw "Expected DB_USER"
if (pass === undefined) throw "Expected DB_PASS"
if (name === undefined) throw "Expected DB_NAME"

const url = `mongodb://${user}:${pass}@${host}:${port}`
const debugUrl = `mongodb://${user}:<password hidden>@${host}:${port}`

export async function connect(onConnected: (database: DatabaseInterface) => Promise<void>): Promise<void> {
	console.log("Connecting to database: " + debugUrl)

	const client = new MongoClient(url, { useUnifiedTopology: true })

	await client.connect()
	await client.db("admin").command({ ping: 1 })

	console.log("Connected!")

	const db = client.db(name)
	const quotes = db.collection<Quote>('quotes')

	onConnected({
		addQuote: async (quoter, quote_parts) => {
			const qc = quotes.find().sort({id:-1}).limit(1)
			const quote: Quote = {
				quote_format: 'v1.2',
				id: (await qc.hasNext() ? (await qc.next() as Quote).id : 0) + 1,
				quoter: quoter.id,
				quote_parts: quote_parts.map(({ user, content }) => { return { user: user.id, content: content } })
			}

			await quotes.insertOne(quote)

			return quote.id
		},
		getRandomQuote: async () => {
			return quotes.aggregate([{ "$sample": { size: 1 } }]).next()
		},
		getQuoteById: async (id) => {
			return quotes.findOne({ id: id })
		},
		getQuoteByUser: async (user) => {
			return quotes.aggregate([
				{ "$match": { 
					"quote_parts": { "$elemMatch": {
						"user": user.id
					} }
				} },
				{ "$sample": { size: 1 } }
			]).next()
		},
		removeQuoteById: async (id) => {
			await quotes.deleteOne({ id: id })
		}
	})
}
