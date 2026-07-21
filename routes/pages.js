const express = require('express');
const client = require('../lib/contentful');
const { seasonLabel } = require('../lib/season');
let { BLOCKS } = require('@contentful/rich-text-types');
let { documentToHtmlString } = require('@contentful/rich-text-html-renderer');

const router = express.Router();

router.get('/', (req, res, next) => {
  client.getEntry('11CRuC0Q5OJb5a8vi4jsjX')
    .then((entry) => documentToHtmlString(entry.fields.richTextField))
    .then((renderedHtml) => {
      res.render('homepage', {
        pageHeading: "Hyde Badminton Club",
        title: "Hyde Badminton Club",
        entry: renderedHtml,
        static_path: "/static"
      });
    })
    .catch(console.error);
});

router.get('/how-to-find-us', (req, res, next) => {
  client.getEntry('4QOXYKaCKzdOrJAuXhraa')
    .then((entry) => documentToHtmlString(entry.fields.richTextField))
    .then((renderedHtml) => {
      res.render('homepage', {
        pageHeading: "How to Find Us",
        title: "How to Find Us",
        entry: renderedHtml,
        static_path: "/static"
      });
    })
    .catch(console.error);
});

router.get('/links', (req, res, next) => {
  client.getEntry('5FLeCM0Gnxal5sOQoim0Kx')
    .then((entry) => documentToHtmlString(entry.fields.richTextField))
    .then((renderedHtml) => {
      res.render('homepage', {
        pageHeading: "Links",
        title: "Links",
        entry: renderedHtml.replace(/\n/g, "</br>"),
        static_path: "/static"
      });
    })
    .catch(console.error);
});

const historyMap = new Map();
historyMap.set("20242025", "6zqgsNYG8b3OkkstTMNRJ5");
historyMap.set("20232024", "2HJ0ys7FijGzNKTKEkl74r");

router.get('/history/:season', (req, res, next) => {
  if (historyMap.has(req.params.season)) {
    const heading = `${seasonLabel(req.params.season)} Tables`;
    client.getEntry(historyMap.get(req.params.season))
      .then((entry) => documentToHtmlString(entry.fields.richTextField))
      .then((renderedHtml) => {
        res.render('homepage', {
          pageHeading: heading,
          title: heading,
          entry: renderedHtml.replace(/\n/g, "</br>"),
          static_path: "/static"
        });
      })
      .catch(console.error);
  } else {
    res.render('homepage', {
      pageHeading: "League History",
      title: "League History",
      entry: "<p>No history for this season selection</p>",
      static_path: "/static"
    });
  }
});

router.get('/gallery', (req, res, next) => {
  client.getEntry('IKaXhRQqSysI0udkAcZXZ')
    .then((entry) => {
      const carouselData = entry.fields.carouselImages.map((image) => ({
        name: image.fields.imageName,
        caption: image.fields.imageCaption,
        source: image.fields.imageSource.fields.file.url
      }));
      res.render('gallery', {
        pageHeading: "Gallery",
        title: "Gallery",
        entry: carouselData,
        static_path: "/static"
      });
    })
    .catch(console.error);
});

router.get('/news', (req, res, next) => {
  client.getEntry('4wpiyFP9LOHKkl0x4xfOSi')
    .then((entry) => {
      let pageHtml = "";
      for (const newsItem of entry.fields.newsItems) {
        pageHtml += "<div class=\"row\"><p class=\"mb-1\">";
        pageHtml += "<strong>" + new Date(newsItem.fields.newsDate).toLocaleDateString("en-GB", {
          year: "numeric",
          month: "long",
          day: "numeric",
        }) + "</strong>&nbsp;";
        const options = {
          renderNode: {
            [BLOCKS.PARAGRAPH]: (node, next) => next(node.content) + "</p>"
          }
        };
        pageHtml += documentToHtmlString(newsItem.fields.newsInfo, options);
        pageHtml += "</div>";
      }
      res.render('homepage', {
        pageHeading: "News",
        title: "News",
        entry: pageHtml,
        static_path: "/static"
      });
    })
    .catch(console.error);
});

router.get('/contact-us', (req, res, next) => {
  client.getEntry('3iaUrVGwS68yA2R1AlioPL')
    .then((entry) => documentToHtmlString(entry.fields.richTextField))
    .then((renderedHtml) => {
      res.render('homepage', {
        pageHeading: "Contact Us",
        title: "Contact Us",
        entry: renderedHtml,
        static_path: "/static"
      });
    })
    .catch(console.error);
});

module.exports = router;
