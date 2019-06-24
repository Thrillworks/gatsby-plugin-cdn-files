const path = require('path');

const fs = require('fs-extra');

const {
  createRemoteFileNode
} = require(`gatsby-source-filesystem`);

const get = require('lodash/get');

async function copyFiles(node, ext) {
  try {
    await fs.copy(path.resolve(node.absolutePath), path.resolve(`public/static/${ext}/${node.base}`));
    console.info('gatsby-plugin-cdn-files INFO: file moved sucessfully');
    return true;
  } catch (err) {
    console.error('gatsby-plugin-cdn-files ERROR:', e);
    return false;
  }
}

exports.onCreateNode = async ({
  node,
  actions,
  store,
  cache,
  createNodeId
}, options) => {
  const {
    createNode
  } = actions;
  const {
    nodeType,
    imagePath,
    name = 'localFile',
    auth = {},
    ext = []
  } = options;
  let fileNode;

  if (node.internal.type === nodeType) {
    const filext = imagePath.split('.').pop();
    const url = get(node, imagePath);

    if (!url) {
      return;
    }
    if (ext.includes(filext)) {
      try {
        fileNode = await createRemoteFileNode({
          url,
          parentNodeId: node.id,
          store,
          cache,
          createNode,
          createNodeId,
          auth,
          fileext
        }); // if the extension is listed in the plugin settings
      } catch (e) {
        console.error('gatsby-plugin-cdn-files ERROR:', e);
      }
        // copy the file
      const copyComplete = copyFiles(fileNode, fileext);

      if (copyComplete) {
        createNodeField({
          node,
          name: 'path',
          value: `/static/${ext}/${fileNode.base}`
        });
        createNodeField({
          node,
          name: 'ext',
          value: fileext
        });
      } else {
        // eslint-disable-next-line no-console
        console.error('gatsby-plugin-cdn-files ERROR', 'error copying the file');
      }
    }
  } // Adds a field `localImage` or custom name to the node
  // ___NODE appendix tells Gatsby that this field will link to another node


  if (fileNode) {
    node[`${name}___NODE`] = fileNode.id;
  }
};