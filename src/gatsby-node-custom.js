// reference file for 

const path = require('path');

const fs = require('fs-extra');
const { GraphQLClient } = require('graphql-request');
const { createRemoteFileNode } = require('gatsby-source-filesystem');

require('dotenv').config({
  path: `.env.${process.env.NODE_ENV}`,
});

async function copyFiles(node) {
  try {
    await fs.copy(path.resolve(node.absolutePath), path.resolve(`public/static/svg/${node.base}`));
          // eslint-disable-next-line no-console
    console.log(path.resolve(node.absolutePath), node.base);
    return true;
  } catch (err) {
    console.error(err);
    return false;
  }
}

exports.onCreateNode = async ({ node, actions, store, cache, createNodeId }) => {
  const {
    createNode,
    createNodeField,
  } = actions;

  const name = 'localImage';
  if (node.internal.type === 'API_LocalImage') {
    // eslint-disable-next-line no-restricted-syntax
    // for (const img of node.allImages) {
    const ext = node.imageLocation.split('.').pop();

      // eslint-disable-next-line no-console
      console.log('downloading img...', node.imageLocation);

      // eslint-disable-next-line no-await-in-loop
      const imageNode = await createRemoteFileNode({
        url: node.imageLocation,
        cache,
        store,
        createNode,
        createNodeId,
        parentNodeId: node.id,
      });

      if (imageNode) node[`${name}___NODE`] = imageNode.id;

      if (ext.includes('svg')) {
        const copyComplete = copyFiles(imageNode);
        if (copyComplete) {
          createNodeField({
            node,
            name: 'path',
            value: `/static/svg/${imageNode.base}`,
          });

          createNodeField({
            node,
            name: 'ext',
            value: 'svg',
          });
        } else {
                // eslint-disable-next-line no-console
          console.error('error copying the file');
        }
      }
  }
};

exports.sourceNodes = async ({ actions, createNodeId, createContentDigest }) => {
  const { createNode } = actions;
  const imagesApi = new GraphQLClient(`${process.env.GRAPHQL_URL}`);

  // Data can come from anywhere, but for now create it manually
  const myData = {
    details: 'All Images from SiteFinity',
  };

  const nodeMeta = {
    id: createNodeId('local-images'),
    parent: null,
    children: [],
    internal: {
      type: 'API_LocalImages',
      contentDigest: createContentDigest(myData),
    },
  };

  const query = /* GraphQL */ `{
    allImages {
      id
      imageLocation
    }
    addItems {
      id
      model
      relativeUrl
      defaultImgUrls
      availableVariants {
        availableColours {
          imgUrls
        }
      }
    }
  }`;

  const data = await imagesApi.request(query);

  /*
  *   loop through the items
  *     for the first two images of the default, find the associated item in allImages and tag it as tileImage
  *     for all the images in the addItems data, find the associated item in allImages and tag it as galleryImage
  */
  const images = JSON.parse(JSON.stringify(data.allImages));
  const tagImage = (img, tags) => {
    const foundIndex = images.findIndex(x => img.indexOf(x.imageLocation) !== -1);

    if (foundIndex === -1) {
      images.push({ imageLocation: img.split('?')[0], tags });
    } else {
      images[foundIndex] = ({ ...images[foundIndex], tags });
    }
  };

  data.addItems.forEach(item => {
    item.defaultImgUrls.forEach((img, idx) => {
      if (idx < 2) {
        // tile image
        tagImage(img, ['tile', 'item']);
      } else {
        tagImage(img, ['item']);
      }
    });
  });

  delete data.addItems;
  delete data.allImages;
  data.allImages = images;

  fs.emptyDir(path.resolve('public/static/svg'), err => {
    if (err) return console.error(err);
    return true;
  });

  const parentNode = Object.assign(nodeMeta, data);
  createNode(parentNode);

  data.allImages.forEach(img => {
    const imageNodeMeta = {
      id: createNodeId('local-image'),
      parent: parentNode.id,
      children: [],
      internal: {
        type: 'API_LocalImage',
        contentDigest: createContentDigest(img),
      },
    };

    const imageNode = Object.assign(imageNodeMeta, img);
    createNode(imageNode);
  });
};
