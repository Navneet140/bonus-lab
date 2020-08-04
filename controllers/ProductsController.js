const Product = require('../models/product');

const puppeteer = require('puppeteer');

const sleep = async time =>  new Promise(resolve => setTimeout(resolve, time * 1000));

exports.index = async (req, res) => {
  const products = await Product.find();
  
  res.render('products/index', {
    pageTitle: 'Walmart Products',
    products
  });
};

exports.update = async (req, res) => {
  const url = 'https://www.walmart.ca/en/appliances/large-appliances/refrigerators/N-2111';
  const products = await scrapeIt(url);

  console.log(products);

 
  
  for (let product of products) {
    if (product.title === "" || product.price === "") continue;
    await Product.updateOne({sku: product.sku}, product, {upsert: true});
  }

  res.redirect('/products');
};

async function scrapeIt (url) {

  
  const browser = await puppeteer.launch({headless: false});
  
  const page = await browser.newPage();
  await page.setViewport({
    width: 1920,
    height: 1080
  });
  await page.exposeFunction('sleep', sleep);

  page.on('dialog', async dialog => {
    await dialog.dismiss();
  });
  page.on('console', msg => console.log(msg._text));

  await page.goto(url);
  await sleep(2);
  await page.screenshot({path: 'screenshots/example.png'});
  
  await page.evaluate(async () => {
    window.scrollBy(0, document.body.scrollHeight);
    await sleep(2);
  });
  await page.waitForSelector(`[class^="productImageContainer"]`, {visible: true, timeout: 120});

  const content = await page.evaluate(async () => {
    const productScrape = document.querySelectorAll('.x-productListItem');
    const products = [];

    for (let product of productScrape) {
      if (!product.querySelector('img')) {
        product.scrollIntoView();
        await sleep(2);
      }

      const link = product.querySelector('a').href;
      const parts = link.split('/');
      const sku = parts[parts.length - 1];

      const title = product.querySelector(`[class^="productItemName"]`).textContent;
      const price = product.querySelector(`meta[itemprop="price"]`).content;
      const image = product.querySelector('img');
      let src = null;
      if (image) src = image.src;

      products.push({sku, title, price, image: src});
    }

    return products;
  });

  await browser.close();
  return content;
}