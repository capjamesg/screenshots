const puppeteer = require("puppeteer");
const express = require("express");
const fs = require("fs");

const app = express();
const port = 9005;

// define screenshot function
async function getScreenshot(url, height, width) {
    // if url is 
    // generate safe file name
    const filename = url.replace(/[^a-z0-9]/gi, '_').toLowerCase();

    // if url includes &reset=true, delete file
    if (url.includes("&reset=true")) {
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
        
        if (domain != "jamesg.blog") {
            return false;
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
