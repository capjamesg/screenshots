const puppeteer = require("puppeteer");
const express = require("express");
const fs = require("fs");

const app = express();
const port = 9005;

const CACHE_CLEAR_KEY = process.env.CACHE_CLEAR_KEY;
const WHITE_LIST_DOMAINS = [
    "jamesg.blog",
    "screenshots.jamesg.blog",
    "avtr.dev",
    "novacast.dev",
    "breakfastand.coffee",
    "jamesg.coffee",
    "archiver.jamesg.blog"
];

if (!CACHE_CLEAR_KEY) {
    console.log("CACHE_CLEAR_KEY not set. Exiting.");
    process.exit(1);
}

// define screenshot function
async function getScreenshot(url, height, width) {
    // if url is 
    // generate safe file name
    const filename = url.replace(/[^a-z0-9]/gi, '_').toLowerCase();

    // if url includes &reset=true, delete file
    if (url.includes("&reset=" + CACHE_CLEAR_KEY)) {
        fs.unlink("images/" + filename + '.png', function (err) {
            if (err) {
                console.log(err);
            }
        });
    }

    // if file exists
    if (fs.existsSync("images/" + filename + '.png')) {
        // read file
        var data = fs.readFileSync("images/" + filename + '.png');

        return data;
    }
    
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    await page.goto(url);
    await page.setViewport({
        height: parseInt(height),
        width: parseInt(width),
    });

    // add a box to bottom right corner that says "Published in 2021"
    // this code is here for exploration, but not used in the app

    // await page.evaluate(() => {
    //     var div = document.createElement("div");
    //     div.style.position = "absolute";
    //     div.style.bottom = "0";
    //     div.style.right = "0";
    //     div.style.padding = "30px";
    //     div.style.backgroundColor = "#FFFF00";
    //     div.style.color = "black";
    //     div.style.fontFamily = "sans-serif";
    //     div.style.fontSize = "48px";
    //     div.style.opacity = "0.8";
    //     div.style.borderLeft = "1px solid black";
    //     div.style.borderTop = "1px solid black";
    //     div.innerHTML = "Published in 2021";
    //     document.body.appendChild(div);
    // });

    const screenshot = await page.screenshot();
    // save to local file
    await page.screenshot({path: "images/" + filename + '.png'});
    
    await browser.close();
    return screenshot;
}

function isValidURL (url) {
    try {
        var full_url = new URL(url);
        var protocol = full_url.protocol;

        if (protocol != "http:" && protocol != "https:") {
            return false;
        }

        // if url doesn't begin with jamesg.blog, skip it
        var domain = full_url.hostname;
        
        if (WHITE_LIST_DOMAINS.includes(domain)) {
            return true;
        }

        return true;
    } catch (err) {
        return false;
    }
}

app.get("/", function (req, res) {
    var height = req.query.height || 540;
    var width = req.query.width || 960;
    var url = req.query.url;

    // max resolution = 1920x1080
    if (height > 1080 || width > 1920) {
        res.status(400).send("Invalid resolution");
        return;
    }

    if (!url) {
        // render index.html
        res.sendFile(__dirname + "/index.html");
        return;
    }

    // if url is invalid, return 400
    if (!isValidURL(url)) {
        res.status(400).send("Invalid URL");
        return;
    }

    var screenshot = getScreenshot(url, height, width);

    // wait for promise
    screenshot.then(function (result) {
        res.set("Content-Type", "image/png");
        res.send(result);
    });
});

app.listen(port, function () {
  console.log(`Screenshot service listening on port ${port}!`);
});
