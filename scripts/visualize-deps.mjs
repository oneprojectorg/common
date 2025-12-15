import { exec as execCallback } from 'child_process';
import fs from 'fs/promises';
import open from 'open';
import os from 'os';
import path from 'path';
import util from 'util';

// Make sure to install this: npm install open --save-dev OR pnpm add -D open

const exec = util.promisify(execCallback);

// --- Helper Functions (will be defined later) ---
async function runTurboGraph() {
  // Runs the pnpm turbo command and returns the DOT graph string output
  console.log('Executing: pnpm turbo run build --graph --dry');

  try {
    // Use --dry, not --dry=json, to get the DOT output
    const { stdout } = await exec('pnpm turbo run build --graph --dry');

    // console.log('DOT Output:\n', stdout); // Optional: log the raw output for debugging
    return stdout;
  } catch (error) {
    console.error(
      'Error running Turborepo command:',
      error.stderr || error.message,
    );
    throw error;
  }
}

function parseDotGraph(dotString) {
  // Parses the DOT graph string into nodes and links for D3
  const nodes = [];
  const links = [];
  const taskMap = {}; // Stores node objects keyed by ID
  const internalDependencies = new Set(); // Keep track of nodes that are targeted by links

  // Regular expression to match edge definitions (e.g., "@op/core" -> "@op/eslint-config";)
  const edgeRegex = /^\s*"([^"]+)"\s*->\s*"([^"]+)"/;
  // Regex to match node definitions with labels (e.g., "ROOT" [label="ROOT"];)
  const nodeRegex = /^\s*"([^"]+)"\s*\[label="([^"]+)"\];$/;

  // --- Pass 1: Collect all node IDs and explicit labels ---
  const allNodeIds = new Set();
  const explicitLabels = {};

  dotString.split('\n').forEach((originalLine) => {
    const currentLine = originalLine.trim();
    const edgeMatch = currentLine.match(edgeRegex);

    if (edgeMatch) {
      allNodeIds.add(edgeMatch[1]);
      allNodeIds.add(edgeMatch[2]);
    }

    const nodeMatch = currentLine.match(nodeRegex);

    if (nodeMatch) {
      allNodeIds.add(nodeMatch[1]);
      explicitLabels[nodeMatch[1]] = nodeMatch[2]; // Store label if defined
    }
  });

  // --- Pass 2: Create node objects ---
  const getNodeType = (id, label) => {
    // Check for root first using the potentially replaced ID or explicit label
    if (id === 'ROOT' || label === 'ROOT') return 'root';
    if (id.includes('config')) return 'config';
    if (id.startsWith('app') || id.startsWith('api')) return 'app'; // Simpler check after #build removed
    if (id.startsWith('@op/')) return 'library';

    return 'library'; // Default
  };

  allNodeIds.forEach((id) => {
    let name = explicitLabels[id] || id;
    let label = explicitLabels[id]; // Keep original label separate for type checking

    const node = {
      id,
      name, // Use the potentially cleaned name for display
      type: getNodeType(id, label), // Pass label for robust root check
    };

    taskMap[id] = node;
    nodes.push(node);
  });

  // Ensure ROOT node exists and has correct type if found
  if (taskMap.ROOT) {
    taskMap.ROOT.type = 'root';
    taskMap.ROOT.name = 'ROOT'; // Ensure display name is ROOT
  } else if (allNodeIds.has('ROOT')) {
    // If ROOT was only involved in edges but not defined explicitly
    const rootNode = { id: 'ROOT', name: 'ROOT', type: 'root' };

    taskMap.ROOT = rootNode;
    nodes.push(rootNode);
  }

  // --- Pass 3: Create links ---
  dotString.split('\n').forEach((originalLine) => {
    const currentLine = originalLine.trim();
    const edgeMatch = currentLine.match(edgeRegex);

    if (edgeMatch) {
      const sourceId = edgeMatch[1];
      const targetId = edgeMatch[2];

      // Ensure both source and target nodes exist in our map
      if (taskMap[sourceId] && taskMap[targetId]) {
        links.push({
          source: sourceId,
          target: targetId,
        });
        internalDependencies.add(targetId);
      } else {
        console.warn(
          `Skipping link due to missing node definition: ${sourceId} -> ${targetId}`,
        );
      }
    }
  });

  // --- Pass 4: Link orphans to root (if root exists) ---
  if (taskMap.ROOT) {
    const rootId = 'ROOT';

    nodes.forEach((node) => {
      if (node.id !== rootId && !internalDependencies.has(node.id)) {
        if (!links.some((l) => l.source === node.id && l.target === rootId)) {
          links.push({ source: node.id, target: rootId });
        }
      }
    });
  } else {
    console.warn('Root node "ROOT" not found in graph, cannot link orphans.');
  }

  console.log(`Parsed ${nodes.length} nodes and ${links.length} links.`);

  return { nodes, links };
}

function generateHtml(nodes, links) {
  // Generates the HTML content with embedded D3 code and data
  const nodesJson = JSON.stringify(nodes);
  const linksJson = JSON.stringify(links);

  // Adapt the React/D3 code from the viz file
  // Note: Removed React wrapper, useEffect, useRef. Using data directly.
  const d3Script = `
    const graphData = {\n      nodes: ${nodesJson},\n      links: ${linksJson}\n    };\n

    const nodes = graphData.nodes;\n    const links = graphData.links;\n

    // SVG dimensions\n    const width = window.innerWidth * 0.95;\n    const height = window.innerHeight * 0.9;\n

    // Color scheme based on node type\n    const colorScale = d3.scaleOrdinal()\n      .domain([\"root\", \"config\", \"library\", \"app\"])\n      .range([\"#ffca3a\", \"#8ac926\", \"#1982c4\", \"#6a4c93\"]);\n

    // Node size based on type\n    const nodeScale = d3.scaleOrdinal()\n      .domain([\"root\", \"config\", \"library\", \"app\"])\n      .range([15, 12, 10, 14]);\n

    // Create SVG container\n    const svg = d3.select(\"#visualization\")\n      .attr(\"width\", width)\n      .attr(\"height\", height)\n      .attr(\"viewBox\", [0, 0, width, height]);\n

    // Add a background with subtle grid pattern\n    svg.append(\"rect\")\n      .attr(\"width\", width)\n      .attr(\"height\", height)\n      .attr(\"fill\", \"#f8f9fa\");\n

    // Add subtle grid lines\n    const gridSize = 20;\n    const grid = svg.append(\"g\")\n      .attr(\"class\", \"grid\");\n

    for (let i = 0; i < height; i += gridSize) {\n      grid.append(\"line\").attr(\"x1\", 0).attr(\"y1\", i).attr(\"x2\", width).attr(\"y2\", i).attr(\"stroke\", \"#e9ecef\").attr(\"stroke-width\", 0.5);\n    }\n    for (let i = 0; i < width; i += gridSize) {\n      grid.append(\"line\").attr(\"x1\", i).attr(\"y1\", 0).attr(\"x2\", i).attr(\"y2\", height).attr(\"stroke\", \"#e9ecef\").attr(\"stroke-width\", 0.5);\n    }\n

    const graphGroup = svg.append(\"g\")\n      .attr(\"class\", \"graph\");\n

    const simulation = d3.forceSimulation(nodes)\n      .force(\"link\", d3.forceLink(links).id(d => d.id).distance(100))\n      .force(\"charge\", d3.forceManyBody().strength(-400))\n      .force(\"center\", d3.forceCenter(width / 2, height / 2))\n      .force(\"x\", d3.forceX(width / 2).strength(0.1))\n      .force(\"y\", d3.forceY(height / 2).strength(0.1))\n      .force(\"collision\", d3.forceCollide().radius(d => nodeScale(d.type) * 2));\n

    const linkGroup = graphGroup.append(\"g\")\n      .attr(\"class\", \"links\");\n

    const link = linkGroup.selectAll(\".link\")\n      .data(links)\n      .enter()\n      .append(\"path\")\n      .attr(\"class\", \"link\")\n      .attr(\"stroke\", \"#adb5bd\")\n      .attr(\"stroke-width\", 1.5)\n      .attr(\"fill\", \"none\")\n      .attr(\"opacity\", 0.6)\n      .attr(\"marker-end\", \"url(#arrowhead)\");\n

    // Define arrowhead marker
    // Adjust refX slightly to account for node radius + arrow size
    const averageNodeRadius = d3.mean(nodes, d => nodeScale(d.type)) || 12;
    const arrowRefX = averageNodeRadius + 8; // Position arrow tip relative to node edge

    svg.append(\"defs\").append(\"marker\")\n      .attr(\"id\", \"arrowhead\")\n      .attr(\"viewBox\", \"0 -5 10 10\")\n      .attr(\"refX\", arrowRefX) // Use calculated static offset
      .attr(\"refY\", 0)\n      .attr(\"markerWidth\", 6)\n      .attr(\"markerHeight\", 6)\n      .attr(\"orient\", \"auto\")\n      .append(\"path\")\n      .attr(\"d\", \"M0,-5L10,0L0,5\")\n      .attr(\"fill\", \"#6c757d\");\n

    const nodeGroup = graphGroup.append(\"g\")\n      .attr(\"class\", \"nodes\");\n

    const node = nodeGroup.selectAll(\".node\")\n      .data(nodes)\n      .enter()\n      .append(\"g\")\n      .attr(\"class\", \"node\")\n      .call(d3.drag()\n        .on(\"start\", dragstarted)\n        .on(\"drag\", dragged)\n        .on(\"end\", dragended));\n

    node.append(\"circle\")\n      .attr(\"r\", d => nodeScale(d.type))\n      .attr(\"fill\", d => colorScale(d.type))\n      .attr(\"stroke\", \"#fff\")\n      .attr(\"stroke-width\", 2)\n      .attr(\"cursor\", \"pointer\");\n

    // Add glow effect (optional, requires filter)\n     const defs = svg.append(\"defs\");\n     const filter = defs.append(\"filter\")\n       .attr(\"id\", \"glow\")\n       .attr(\"x\", \"-50%\").attr(\"y\", \"-50%\").attr(\"width\", \"200%\").attr(\"height\", \"200%\");\n     filter.append(\"feGaussianBlur\").attr(\"stdDeviation\", \"2.5\").attr(\"result\", \"coloredBlur\");\n     const feMerge = filter.append(\"feMerge\");\n     feMerge.append(\"feMergeNode\").attr(\"in\", \"coloredBlur\");\n     feMerge.append(\"feMergeNode\").attr(\"in\", \"SourceGraphic\");\n

     node.append(\"circle\") // Apply glow\n       .attr(\"r\", d => nodeScale(d.type))\n       .attr(\"fill\", \"none\")\n       .attr(\"stroke\", d => colorScale(d.type))\n       .attr(\"stroke-width\", 1)\n       .attr(\"opacity\", 0.5)\n       .attr(\"filter\", \"url(#glow)\")\n       .attr(\"pointer-events\", \"none\"); // Make glow non-interactive\n

    node.append(\"text\")\n      .attr(\"dx\", d => nodeScale(d.type) + 4)\n      .attr(\"dy\", \".35em\")\n      .attr(\"font-family\", \"sans-serif\")\n      .attr(\"font-size\", 12)\n      .attr(\"pointer-events\", \"none\")\n      .text(d => d.name) // Use the parsed name\n      .attr(\"fill\", \"#343a40\")\n      .each(function(d) {\n        if (d.type === \"root\") {\n          d3.select(this).attr(\"font-weight\", \"bold\").attr(\"font-size\", 14);\n        }\n      });\n

    const tooltip = d3.select(\"body\").append(\"div\")\n      .attr(\"class\", \"tooltip\")\n      .style(\"position\", \"absolute\")\n      .style(\"text-align\", \"center\")\n      .style(\"padding\", \"8px\")\n      .style(\"font-family\", \"sans-serif\")\n      .style(\"font-size\", \"12px\")\n      .style(\"background\", \"white\")\n      .style(\"border\", \"1px solid #ddd\")\n      .style(\"border-radius\", \"4px\")\n      .style(\"pointer-events\", \"none\")\n      .style(\"opacity\", 0);\n

    node.on(\"mouseover\", function(event, d) {\n        d3.select(this).select(\"circle\").first()\n          .transition().duration(200)\n          .attr(\"r\", nodeScale(d.type) * 1.2);\n

        link.transition().duration(200)\n          .attr(\"opacity\", l => (l.source.id === d.id || l.target.id === d.id) ? 1 : 0.1)\n          .attr(\"stroke-width\", l => (l.source.id === d.id || l.target.id === d.id) ? 2.5 : 1);\n

        tooltip.style(\"opacity\", 0.9)\n          .html(\`<strong>\${d.name}</strong><br/>ID: \${d.id}<br/>Type: \${d.type}\`) // Show full ID in tooltip\n          .style(\"left\", (event.pageX + 10) + \"px\")\n          .style(\"top\", (event.pageY - 28) + \"px\");\n      })\n      .on(\"mouseout\", function(event, d) {\n        d3.select(this).select(\"circle\").first()\n          .transition().duration(200)\n          .attr(\"r\", nodeScale(d.type));\n

        link.transition().duration(200)\n          .attr(\"opacity\", 0.6)\n          .attr(\"stroke-width\", 1.5);\n

        tooltip.style(\"opacity\", 0);\n      });

    const legend = svg.append(\"g\")\n      .attr(\"class\", \"legend\")\n      .attr(\"transform\", \`translate(\${width - 150}, 30)\`);\n

    const legendItems = [\n      { type: \"root\", label: \"Root\" },\n      { type: \"config\", label: \"Config\" },\n      { type: \"library\", label: \"Library\" },\n      { type: \"app\", label: \"Application\" }\n    ];

    legendItems.forEach((item, i) => {\n      const legendItem = legend.append(\"g\").attr(\"transform\", \`translate(0, \${i * 25})\`);\n      legendItem.append(\"circle\").attr(\"r\", 6).attr(\"fill\", colorScale(item.type));\n      legendItem.append(\"text\").attr(\"x\", 15).attr(\"y\", 4).attr(\"font-family\", \"sans-serif\").attr(\"font-size\", 12).text(item.label);\n    });

    svg.append(\"text\")\n      .attr(\"x\", 20).attr(\"y\", 30)\n      .attr(\"font-family\", \"sans-serif\").attr(\"font-size\", 18).attr(\"font-weight\", \"bold\")\n      .text(\"Package Dependency Graph\");

    svg.append(\"text\")\n      .attr(\"x\", 20).attr(\"y\", 50)\n      .attr(\"font-family\", \"sans-serif\").attr(\"font-size\", 12).attr(\"fill\", \"#6c757d\")\n      .text(\"Visualizing Turborepo build dependencies\");

    function dragstarted(event, d) {\n      if (!event.active) simulation.alphaTarget(0.3).restart();\n      d.fx = d.x;\n      d.fy = d.y;\n    }\n

    function dragged(event, d) {\n      d.fx = event.x;\n      d.fy = event.y;\n    }\n

    function dragended(event, d) {\n      if (!event.active) simulation.alphaTarget(0);\n      d.fx = null;\n      d.fy = null;\n    }\n

    simulation.on(\"tick\", () => {\n      link.attr(\"d\", d => {\n        // Check if source or target has been dragged (fx/fy are set)\n        // Or if the node positions haven\'t initialized yet (rare)\n        if (!d.source.x || !d.source.y || !d.target.x || !d.target.y) {\n             return null; // Don\'t draw the link yet\n        }\n        const dx = d.target.x - d.source.x;\n        const dy = d.target.y - d.source.y;\n        const dist = Math.sqrt(dx * dx + dy * dy);\n        // Use a fixed curve for simplicity, avoids division by zero if dist is 0\n        const dr = dist * 1.5; \n        return \`M\${d.source.x},\${d.source.y}A\${dr},\${dr} 0 0,1 \${d.target.x},\${d.target.y}\`;\n      });\n

      node.attr(\"transform\", d => {\n         // Prevent NaN translations if simulation hasn\'t stabilized\n         const x = d.x || 0;\n         const y = d.y || 0;\n         return \`translate(\${x},\${y})\`;\n      });\n

      // Arrowhead position is fixed relative to the node edge by refX, no tick update needed here\n       \n    });

    const zoom = d3.zoom()\n      .scaleExtent([0.1, 8])\n      .on(\"zoom\", (event) => {\n        graphGroup.attr(\"transform\", event.transform);\n      });

    svg.call(zoom);

    const controls = svg.append(\"g\")\n      .attr(\"class\", \"controls\")\n      .attr(\"transform\", \`translate(20, \${height - 60})\`);\n

    const resetButton = controls.append(\"g\")\n      .attr(\"cursor\", \"pointer\")\n      .on(\"click\", () => {\n        svg.transition().duration(750).call(zoom.transform, d3.zoomIdentity);\n      });

    resetButton.append(\"rect\").attr(\"width\", 80).attr(\"height\", 30).attr(\"rx\", 5).attr(\"fill\", \"#f8f9fa\").attr(\"stroke\", \"#ced4da\");
    resetButton.append(\"text\").attr(\"x\", 40).attr(\"y\", 20).attr(\"text-anchor\", \"middle\").attr(\"font-family\", \"sans-serif\").attr(\"font-size\", 12).text(\"Reset Zoom\");

    const fitButton = controls.append(\"g\")\n      .attr(\"cursor\", \"pointer\")\n      .attr(\"transform\", \"translate(90, 0)\")\n      .on(\"click\", () => { simulation.alpha(0.5).restart(); }); // Give it a bit more energy

    fitButton.append(\"rect\").attr(\"width\", 80).attr(\"height\", 30).attr(\"rx\", 5).attr(\"fill\", \"#f8f9fa\").attr(\"stroke\", \"#ced4da\");
    fitButton.append(\"text\").attr(\"x\", 40).attr(\"y\", 20).attr(\"text-anchor\", \"middle\").attr(\"font-family\", \"sans-serif\").attr(\"font-size\", 12).text(\"Rearrange\");

    // Optional: Resize handler if needed
    // window.addEventListener(\'resize\', () => {\n    //   const newWidth = window.innerWidth * 0.95;\n    //   const newHeight = window.innerHeight * 0.9;\n    //   svg.attr(\"width\", newWidth).attr(\"height\", newHeight).attr(\"viewBox\", [0, 0, newWidth, newHeight]);\n    //   simulation.force(\"center\", d3.forceCenter(newWidth / 2, newHeight / 2)).alpha(0.1).restart();\n    // });

  `;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Turborepo Dependency Graph</title>
  <style>
    body { margin: 0; overflow: hidden; background-color: #f8f9fa; font-family: sans-serif; }
    svg { display: block; margin: auto; background-color: white; }
    .tooltip {
        position: absolute;
        text-align: center;
        padding: 8px;
        font: 12px sans-serif;
        background: white;
        border: 1px solid #ccc;
        border-radius: 4px;
        pointer-events: none; /* prevent tooltip from interfering with mouse events */
        opacity: 0;
        transition: opacity 0.2s;
        z-index: 10;
        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    }
    .controls g {
        transition: transform 0.2s ease-out;
    }
    .controls g:hover rect {
        fill: #e9ecef;
    }
  </style>
</head>
<body>
  <svg id="visualization"></svg>

  <script src="https://d3js.org/d3.v7.min.js"></script>
  <script>
    ${d3Script}
  </script>
</body>
</html>
`;
}

// --- Main Execution Logic ---
async function main() {
  try {
    console.log('Generating dependency graph...');
    const dotString = await runTurboGraph();
    const cleanDotString = dotString
      .replaceAll('#build', '')
      .replaceAll('[root] ', '')
      .replaceAll('___ROOT___', 'ROOT');

    console.log('Parsing graph data...');
    const { nodes, links } = parseDotGraph(cleanDotString);

    console.log('Generating visualization HTML...');
    const htmlContent = generateHtml(nodes, links);

    const tempHtmlPath = path.join(
      os.tmpdir(),
      `dependency-graph-${Date.now()}.html`,
    );

    console.log(`Writing HTML to: ${tempHtmlPath}`);
    await fs.writeFile(tempHtmlPath, htmlContent);

    console.log('Opening visualization in browser...');
    await open(tempHtmlPath);

    console.log('Done!');
  } catch (error) {
    console.error('Error visualizing dependencies:', error);
    process.exit(1);
  }
}

main();
