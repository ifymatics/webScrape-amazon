const puppeteer = require("puppeteer");
const fs = require("fs");
const utils = require("./utils");

module.exports = (async () => {
  //DOM SELECTORS
  const selectors = {
    searchInput: "#twotabsearchtextbox",

    acceptCookies: "#sp-cc-accept",
    products:
      ".s-matching-dir.sg-col-16-of-20.sg-col.sg-col-8-of-12.sg-col-12-of-16",
    productContainer: "div.s-result-item.s-asin.sg-col-0-of-12.sg-col-16-of-20",

    paginationNext: ".s-pagination-next",

    anchorLink: ".a-size-mini.a-spacing-none.a-color-base.s-line-clamp-2 a",
    previousButton:
      ".s-pagination-item.s-pagination-previous.s-pagination-disabled",
    currentPage: ".s-pagination-item.s-pagination-selected",
    nextPage: ".s-pagination-item.s-pagination-button",
  };
  let browser, page;
  let scrapedProducts = [];

  let resultPosition = 0;

  try {
    browser = await puppeteer.launch({ headless: false });
    page = await browser.newPage();
    console.log("... Opening https://www.amazon.co.uk ...");
    await page.goto("https://www.amazon.co.uk");
    (await page.$(selectors.acceptCookies)) !== null &&
      (await page.click(selectors.acceptCookies));

    console.log("... Typing 'headphone' in the search bar ...");
    await page.type(selectors.searchInput, "headphones");

    await page.keyboard.press("Enter");
    //WAIT FOR THE REQUIRED DOM TO LOAD
    await page.waitForSelector(selectors.products);
    await page.waitForSelector(selectors.paginationNext);
  } catch (error) {
    console.log(`==> Error on line 29 - 44  is :${error.message}`);
  }
  async function scrapeCurrentPage(currentPage) {
    let urls;
    try {
      await page.waitForSelector(selectors.anchorLink);
      // GET THE LINKS OF ALL THE PRODUCTS IN THE PAGE
      urls = await page.$$eval(selectors.productContainer, (links) => {
        // GET THE LINKS OF EACH PRODUCT
        return links.map((el) => el.querySelector("h2 > a").href);
      });
    } catch (error) {
      console.log(`==> Error on line 43 - 50  is :${error.message}`);
    }
    //LOOP THROUGH EACH OF THE EXTRACTED URL, OPEN A NEW PAGE INSTANCE AND SCRAPE THE NEEDED DATA
    let pagePromise = (link) =>
      new Promise(async (resolve, reject) => {
        let dataObj = {};
        const productDetails = {
          productContainer: ".en-GB #dp-container",
          price: ".a-offscreen",
          previousPrice: "span.a-price.a-text-price .a-offscreen",
          title: "#productTitle",
          numberOfReviews: "#acrCustomerReviewText",
          rating: "span.a-icon-alt",
          image: "#imgTagWrapperId img",
          sponsored: "#ad-feedback-text-ams-detail-right-v2",
        };

        let newPage;
        try {
          newPage = await browser.newPage();
          await newPage.goto(link);
          await newPage.waitForSelector(productDetails.title);
          dataObj["title"] = await newPage.$eval(productDetails.title, (text) =>
            text.textContent.trim()
          );
          dataObj["link"] = link;
          dataObj["image"] = await newPage.$eval(
            productDetails.image,
            (img) => img.src
          );
          dataObj["isSponsored"] =
            (await newPage.$(productDetails.sponsored)) !== null
              ? await newPage.$eval(
                  productDetails.sponsored,
                  (span) => span.textContent.trim() === "Sponsored"
                )
              : false;
          dataObj["price"] =
            (await newPage.$(productDetails.price)) !== null
              ? await newPage.$eval(productDetails.price, (text) =>
                  Number(text.textContent.slice(1))
                )
              : null;
          const previousPrice =
            (await newPage.$(productDetails.previousPrice)) !== null
              ? await newPage.$eval(productDetails.previousPrice, (text) =>
                  Number(text.textContent.slice(1))
                )
              : null;
          if (previousPrice) {
            dataObj["previousPrice"] = previousPrice;
          }
          dataObj["numberOfReviews"] = await newPage.$eval(
            productDetails.numberOfReviews,
            (text) => Number(text.textContent.split(" ")[0].split(",").join(""))
          );

          const rating = await newPage.$eval(
            productDetails.rating,
            (span) => span.textContent
          );
          dataObj["rating"] = utils.getRating(rating);

          dataObj["resultPage"] = currentPage;
          dataObj["resultPosition"] = resultPosition + 1;
          resolve(dataObj);
          await newPage.close();
        } catch (error) {
          console.log(`==> Error on line 71 - 125  is :${error.message}`);
          await newPage.close();
          await browser.close();
        }
      });

    for (link in urls) {
      // THE LOOP IS USED HERE  TO RUN await pagePromise(urls[link]) IN SERIES
      //AS AGAINST USING await Promise.all(pagePromise(urls[link]))
      // BECAUSE THE LATER RUNS PRMISE IN PARALLEL
      // THAT COULD THE DANGEROUS TO LOCAL MACHINE MEMORY USAGE
      try {
        let currentPageData = await pagePromise(urls[link]);
        scrapedProducts.push(currentPageData);
      } catch (error) {
        console.log(`==> Error on line 129 - 134  is :${error.message}`);
      }
    }
    urls = [];
  }

  try {
    if ((await page.$(selectors.previousButton)) !== null) {
      console.log("... Scraping data from the first page ...");
      await scrapeCurrentPage(1); // CALL THIS FUNCTION TO SCRAPE THE FIRST PAGE
    }
    //WHEN THE FIRST PAGE IS DONE, THEN CONTINUE WITH THE NEXT PAGE
    if (
      (await page.$eval(selectors.currentPage, (a) => a.textContent)) === "1" &&
      (await page.$eval(selectors.nextPage, (a) => a.textContent)) === "2"
    ) {
      const nextPage = await page.waitForSelector(selectors.paginationNext);
      await nextPage.click();
      await page.waitForSelector(selectors.products);
      console.log("... Scraping data from the second page ...");
      await scrapeCurrentPage(2); // CALL THIS FUNCTION TO SCRAPE THE SECOND PAGE
      await page.close();
      await browser.close();
      //WRITE TO output.json FILE ONLY IF THERE IS A SCRAPED DATA
      console.log("... writing to output.json file ...");
      scrapedProducts.length > 0 &&
        fs.writeFile(
          "results/output.json",
          JSON.stringify(scrapedProducts),
          "utf8",
          function (err) {
            if (err) {
              return console.log(err);
            }
            console.log(
              "... The data has been scraped and saved successfully! View it at './results/output.json' ..."
            );
          }
        );
    }
  } catch (error) {
    console.log(`==> Error on line 139 - 174 is :${error.message}`);
  }
})();
