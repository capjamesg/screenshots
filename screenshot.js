const puppeteer = require("puppeteer");
const express = require("express");
const fs = require("fs");
const supabase = require("@supabase/supabase-js");
const ejs = require("ejs");

// load all values in config.js
const config = require("./config.js");

const app = express();

// if images/ doesn't exist, create it
if (!fs.existsSync("images/")) {
    fs.mkdirSync("images/");
}

if (!config.CACHE_CLEAR_KEY) {
    console.log("CACHE_CLEAR_KEY not set. Exiting.");
    process.exit(1);
}

// const client = supabase.createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const client = supabase.createClient(config.SUPABASE_URL, config.SUPABASE_KEY);

// define screenshot function
async function getScreenshot(url, height, width) {
    // if url is 
    // generate safe file name
    const filename = url.replace(/[^a-z0-9]/gi, '_').toLowerCase();

    // strip all query params
    url = url.split("?")[0];

    // if url includes &reset=true, delete file
    if (url.includes("&reset=" + config.CACHE_CLEAR_KEY)) {
        fs.unlink("images/" + filename + '.png', function (err) {
            if (err) {
                console.log(err);
            }
        });
        deleteFromSupabase(url);
    }

    // if file exists
    if (fs.existsSync("images/" + filename + '.png')) {
        // read file
        var data = fs.readFileSync("images/" + filename + '.png');

        return data;
    }

    var screenshot = "";
    
    try {
        const browser = await puppeteer.launch();
        const page = await browser.newPage();

        await page.goto(url);
        await page.setViewport({
            height: parseInt(height),
            width: parseInt(width),
        });

        // save to supabase
        saveToSupabase(url, width, height);

        screenshot = await page.screenshot();
        // save to local file
        await page.screenshot({path: "images/" + filename + '.png'});
        
        await browser.close();
    } catch (err) {
        console.log(err);
    }
    return screenshot;
}

function isValidURL (url) {
    try {
        var full_url = new URL(url);
        var protocol = full_url.protocol;

        if (protocol != "http:" && protocol != "https:") {
            return false;
        }
        return true;
    } catch (err) {
        return false;
    }
}

function isWhitelistedURL (url) {
    var full_url = new URL(url);
    var host = full_url.host;

    if (config.WHITE_LIST_DOMAINS.includes(host)) {
        return true;
    }
    return false;
}

async function saveToSupabase(url, width, height) {
    const { data, error } = await client
        .from('Screenshots')
        .insert([
            { url: url, width: width, height: height, image_url: "/?url=" + url + "&width=" + width + "&height=" + height },
        ]);
    console.log(data, error);
}

async function deleteFromSupabase(url) {
    const { data, error } = await client
        .from('Screenshots')
        .delete()
        .match({ url: url });
}

async function getAllScreenshots(){
    const { data, error } = await client
        .from('Screenshots')
        .select('*');
        
    return data;
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

    if (!isWhitelistedURL(url)) {
        res.status(400).send("Hostname not whitelisted");
        return;
    }

    var screenshot = getScreenshot(url, height, width);
    
    // wait for promise
    screenshot.then(function (result) {
        res.set("Content-Type", "image/png");
        res.send(result);
    });
});

app.get("/screenshots", function (req, res) {
    var data = getAllScreenshots();
    data.then(function (result) {
        // send templated file
        var template = fs.readFileSync("screenshots.html", "utf8");
        var rendered = ejs.render(template, {screenshots: result});
        res.send(rendered);
    });
});

app.listen(config.PORT, function () {
  console.log(`Screenshot service listening on port ${config.PORT}!`);
});
