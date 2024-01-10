const express = require('express')
const app = express()
const PORT = process.env.PORT ?? 1234

const info = require('./info.json')

app.disable('x-powered-by')


app.get('/', (req, res) => {
        res.header('Access-Control-Allow-Origin', '*')  
    
    return res.json(info)
})


app.listen(PORT, ()=>{
    console.log(`servidor escuchando en el puerto http://localhost:${PORT}`)
})