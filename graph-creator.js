document.onload = (function (d3, saveAs, Blob, undefined) {
  "use strict";

  // TODO add user settings
  var consts = {
    defaultTitle: "way point"
  };
  var settings = {
    appendElSpec: "#graph"
  };
  // define graphcreator object
  var GraphCreator = function (svg, nodes, edges) {
    var thisGraph = this;
    thisGraph.idct = 0;

    thisGraph.nodes = nodes || [];
    thisGraph.edges = edges || [];

    thisGraph.state = {
      selectedNode: null,
      selectedEdge: null,
      mouseDownNode: null,
      mouseDownLink: null,
      justDragged: false,
      justScaleTransGraph: false,
      lastKeyDown: -1,
      shiftNodeDrag: false,
      selectedText: null
    };

    // define arrow markers for graph links
    var defs = svg.append('svg:defs');
    defs.append('svg:marker')
      .attr('id', 'end-arrow')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', "32")
      .attr('markerWidth', 3.5)
      .attr('markerHeight', 3.5)
      .attr('orient', 'auto')
      .append('svg:path')
      .attr('d', 'M0,-5L10,0L0,5');

    // define arrow markers for leading arrow
    defs.append('svg:marker')
      .attr('id', 'mark-end-arrow')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 7)
      .attr('markerWidth', 3.5)
      .attr('markerHeight', 3.5)
      .attr('orient', 'auto')
      .append('svg:path')
      .attr('d', 'M0,-5L10,0L0,5');

    thisGraph.svg = svg; // background svg element
    thisGraph.svgG = svg.append("g")
      .classed(thisGraph.consts.graphClass, true);
    var svgG = thisGraph.svgG;

    // displayed when dragging between nodes
    thisGraph.dragLine = svgG.append('svg:path')
      .attr('class', 'link dragline hidden')
      .attr('d', 'M0,0L0,0')
      .style('marker-end', 'url(#mark-end-arrow)');

    // svg nodes and edges
    thisGraph.paths = svgG.append("g").selectAll("g");// all edge html element. 
    thisGraph.circles = svgG.append("g").selectAll("g"); // all nodes html element. 



    thisGraph.drag = d3.behavior.drag()
      .origin(function (d) {
        return { x: d.x, y: d.y };
      })
      .on("drag", function (d) {
        thisGraph.state.justDragged = true;
        thisGraph.dragmove.call(thisGraph, d);
        d3.select(this).select("text[text-type=location] tspan").text("(" + d.x + ", " + d.y + ")") // dynamics show x.y
        // .style("background-color", "red")
        // thisGraph.buttonConfig(d3node, d);
        // thisGraph.nodes.push(d);
        // thisGraph.updateGraph();
        // d3.select("#node-configuration-container").attr("visibility", "hidden").attr("class", "hidden");
      })
      .on("dragend", function (d) {
        var d3node = thisGraph.circles.filter(function (dval) {
          return dval.id === d.id;
        })
        // thisGraph.replaceSelectNode(d3node, d)

        var state = thisGraph.state
        var prevNode = state.selectedNode;

        if (!prevNode || prevNode.id !== d.id) {
          thisGraph.replaceSelectNode(d3node, d);
        }
      });

    // listen for key events
    d3.select(window).on("keydown", function () {
      thisGraph.svgKeyDown.call(thisGraph);
    })
      .on("keyup", function () {
        thisGraph.svgKeyUp.call(thisGraph);
      });
    svg.on("mousedown", function (d) { thisGraph.svgMouseDown.call(thisGraph, d); });
    svg.on("mouseup", function (d) { thisGraph.svgMouseUp.call(thisGraph, d); });

    // listen for dragging
    var dragSvg = d3.behavior.zoom()
      .on("zoom", function () {
        if (d3.event.sourceEvent.shiftKey) {
          // TODO  the internal d3 state is still changing
          return false;
        } else {
          thisGraph.zoomed.call(thisGraph);
        }
        return true;
      })
      .on("zoomstart", function () {
        var ael = d3.select("#" + thisGraph.consts.activeEditId).node();
        if (ael) {
          ael.blur();
        }
        if (!d3.event.sourceEvent.shiftKey) d3.select('body').style("cursor", "move");
      })
      .on("zoomend", function () {
        d3.select('body').style("cursor", "auto");
      });

    svg.call(dragSvg).on("dblclick.zoom", null);

    // listen for resize
    window.onresize = function () { thisGraph.updateWindow(svg); };


    d3.selectAll("g g").on("click", function () {
      // TODO: figure out why selector g g can work, g or g g g not work
      console.log("click circle");

      var selectedNode = d3.select(".selected") // this is d3node
      if (selectedNode.size() != 0) {
        var thisID = selectedNode.select("text.data-location").attr("node-id")
        var d = thisGraph.nodes.filter(function (dval) {
          return dval.id.toString() === thisID;
        })[0]
        thisGraph.buttonConfig(selectedNode, d);
        d3.select("#node-configuration-container").attr("visibility", "visible").attr("class", "visible");
      }

    })


    svg.on("dblclick", function () {

      if (thisGraph.consts.autoSave){
        document.getElementById("node-save-button").click(); 
      }
      d3.select("#node-configuration-container").attr("visibility", "hidden").attr("class", "hidden");
      // d3.event.stopPropagation();
      if (thisGraph.state.selectedNode) {
        thisGraph.removeSelectFromNode();
      }
      console.log("check background");
    })

    // handle download data
    d3.select("#download-input").on("click", function () {
      var saveEdges = [];
      thisGraph.edges.forEach(function (val, i) {
        saveEdges.push({ source: val.source.id, target: val.target.id });
      });
      var blob = new Blob([window.JSON.stringify({ "nodes": thisGraph.nodes, "edges": saveEdges })], { type: "text/plain;charset=utf-8" });
      saveAs(blob, "mydag.json");
    });



    // handle uploaded data
    d3.select("#upload-input").on("click", function () {
      document.getElementById("hidden-file-upload").click();
    });


    d3.select("#hidden-file-upload").on("change", function () {
      if (window.File && window.FileReader && window.FileList && window.Blob) {
        var uploadFile = this.files[0];
        var filereader = new window.FileReader();

        filereader.onload = function () {
          var txtRes = filereader.result;
          // TODO better error handling
          try {
            var jsonObj = JSON.parse(txtRes);
            thisGraph.deleteGraph(true);
            thisGraph.nodes = jsonObj.nodes;
            thisGraph.setIdCt(jsonObj.nodes.length + 1);
            var newEdges = jsonObj.edges;
            newEdges.forEach(function (e, i) {
              newEdges[i] = {
                source: thisGraph.nodes.filter(function (n) { return n.id == e.source; })[0],
                target: thisGraph.nodes.filter(function (n) { return n.id == e.target; })[0]
              };
            });
            thisGraph.edges = newEdges;
            thisGraph.updateGraph();
          } catch (err) {
            window.alert("Error parsing uploaded file\nerror message: " + err.message);
            return;
          }
        };
        filereader.readAsText(uploadFile);

      } else {
        alert("Your browser won't let you save this graph -- try upgrading your browser to IE 10+ or Chrome or Firefox.");
      }

    });

    // handle delete graph
    d3.select("#delete-graph").on("click", function () {
      thisGraph.deleteGraph(false);
    });
  };

  GraphCreator.prototype.setIdCt = function (idct) {
    this.idct = idct;
  };

  GraphCreator.prototype.consts = {
    selectedClass: "selected",
    connectClass: "connect-node",
    circleGClass: "conceptG",
    graphClass: "graph",
    activeEditId: "active-editing",
    BACKSPACE_KEY: 8,
    DELETE_KEY: 46,
    ENTER_KEY: 13,
    nodeRadius: 50,
    autoSave: true
  };

  /* PROTOTYPE FUNCTIONS */

  GraphCreator.prototype.dragmove = function (d) {
    var thisGraph = this;
    if (thisGraph.state.shiftNodeDrag) {
      thisGraph.dragLine.attr('d', 'M' + d.x + ',' + d.y + 'L' + d3.mouse(thisGraph.svgG.node())[0] + ',' + d3.mouse(this.svgG.node())[1]);
    } else {
      d.x += d3.event.dx;
      d.y += d3.event.dy;
      thisGraph.updateGraph();
    }
  };

  GraphCreator.prototype.deleteGraph = function (skipPrompt) {
    var thisGraph = this,
      doDelete = true;
    if (!skipPrompt) {
      doDelete = window.confirm("Press OK to delete this graph");
    }
    if (doDelete) {
      thisGraph.nodes = [];
      thisGraph.edges = [];
      thisGraph.updateGraph();
    }
  };

  /* select all text in element: taken from http://stackoverflow.com/questions/6139107/programatically-select-text-in-a-contenteditable-html-element */
  GraphCreator.prototype.selectElementContents = function (el) {
    var range = document.createRange();
    range.selectNodeContents(el);
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  };


  /* insert svg line breaks: taken from http://stackoverflow.com/questions/13241475/how-do-i-include-newlines-in-labels-in-d3-charts */
  GraphCreator.prototype.insertTitleLinebreaks = function (gEl, title) {
    var words = title.split(/\s+/g),
      nwords = words.length;
    var el = gEl.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "-" + (nwords - 1) * 7.5);

    for (var i = 0; i < words.length; i++) {
      var tspan = el.append('tspan').text(words[i]);
      if (i > 0)
        tspan.attr('x', 0).attr('dy', '15');
    }
  };

  GraphCreator.prototype.showXY = function (gEl, d) {

    var el = gEl.append("text").attr("text-anchor", "middle").attr("text-type", "location").attr("node-id", d.id).attr("class", "data-location");
    el.append('tspan').attr('dy', 30).text("(" + d.x + ", " + d.y + ")")
  };

  GraphCreator.prototype.buttonConfig = function (gEl, d) {
    var thisGraph = this;

    // remove previous form content
    if (d3.select("#nodeConfig form")) {
      d3.select("#nodeConfig form").remove("form")
    }

    // targeting form container and insert node information
    var el = d3.select("#nodeConfig").append("form").attr("id", "node-configuration-container").attr("visibility", "visible").attr("class", "visible")
    for (let key in d) {
      if (key == "id") {
        el.append("div").attr("class", "input-container").html(generateTextInputHTML(key, key, key, d[key], "number", true))
      }
      else if (key == "x" || key == "y") {
        el.append("div").attr("class", "input-container").html(generateTextInputHTML(key, key, key, d[key], "number", false))
      }
      else {
        el.append("div").attr("class", "input-container").html(generateTextInputHTML(key, key, key, d[key]))
      }
    }

    // add button tag
    el.append("div").attr("class", "button-container").html(`<button type="button" id="node-save-button" value="Save">save</button>`)

    // targeting submit button and update node in graph
    d3.select("#node-save-button").on("click", function () {
      var thisForm = d3.select("#node-configuration-container");
      var updatedNode = parseForm(thisForm);
      thisGraph.updateNode.call(thisGraph, updatedNode)

    })
  };


  var parseForm = function (thisForm) {
    var formData = {};

    if (thisForm == undefined) {
      formData = {
        "id": "-1",
        "title": "way point",
        "x": 0,
        "y": 0,
        "extraString": "stringify json?",
        "metaData": "{\"key\":\"value\"}"
      }
      return formData
    }


    (thisForm.selectAll("input, select, textarea")[0]).forEach(function (elem, index) {
      var key = String(elem.getAttribute("name"));
      var value = elem.value;
      if (key == "x" || key == "y") {
        formData[key] = Number(value);
      } else if (key == "metaData") {
        formData[key] = JSON.parse(value);
      }
      else {
        formData[key] = value;
      }
    });
    return formData
  }

  var generateTextInputHTML = function (id, label, fname, defaultValue, type = "text", readonly = false) {
    var html = "";
    html += `<label for="${id}">${label}</label>`;
    html += `<input type="${type}" id="${id}" name="${fname}" value=${JSON.stringify(defaultValue)} ${readonly ? "readonly" : ""}></input>`;
    return html
  }

  GraphCreator.prototype.updateNode = function (updatedNode) {
    var thisGraph = this;
    var d = thisGraph.nodes.filter(function (n) { return n.id == updatedNode.id; })[0]
    var d3node = thisGraph.circles.filter(function (n) { return n.id == updatedNode.id; })

    if (d == undefined) {
      thisGraph.nodes.push(updatedNode)
    }
    else {
      d.title = updatedNode.title;
      d.x = updatedNode.x
      d.y = updatedNode.y
      d.extraString = updatedNode.extraString
      d.metaData = updatedNode.metaData
    }

    // clean duplicate element information
    d3node.selectAll("text").remove();

    thisGraph.insertTitleLinebreaks(d3node, d.title); // append new title
    thisGraph.buttonConfig(d3node, d); // pop out new div config
    thisGraph.showXY(d3node, d); // display new x,y location

    thisGraph.updateGraph();
  }


  // remove edges associated with a node
  GraphCreator.prototype.spliceLinksForNode = function (node) {
    var thisGraph = this,
      toSplice = thisGraph.edges.filter(function (l) {
        return (l.source === node || l.target === node);
      });
    toSplice.map(function (l) {
      thisGraph.edges.splice(thisGraph.edges.indexOf(l), 1);
    });
  };

  GraphCreator.prototype.replaceSelectEdge = function (d3Path, edgeData) {
    var thisGraph = this;
    d3Path.classed(thisGraph.consts.selectedClass, true);
    if (thisGraph.state.selectedEdge) {
      thisGraph.removeSelectFromEdge();
    }
    thisGraph.state.selectedEdge = edgeData;
  };

  GraphCreator.prototype.replaceSelectNode = function (d3Node, nodeData) {
    // show/hide when click node
    var thisGraph = this;
    d3Node.classed(this.consts.selectedClass, true);
    if (thisGraph.state.selectedNode) {
      thisGraph.removeSelectFromNode();
    }
    thisGraph.state.selectedNode = nodeData;
  };

  GraphCreator.prototype.removeSelectFromNode = function () {
    var thisGraph = this;
    thisGraph.circles.filter(function (cd) {
      return cd.id === thisGraph.state.selectedNode.id;
    }).classed(thisGraph.consts.selectedClass, false);
    thisGraph.state.selectedNode = null;
  };

  GraphCreator.prototype.removeSelectFromEdge = function () {
    var thisGraph = this;
    thisGraph.paths.filter(function (cd) {
      return cd === thisGraph.state.selectedEdge;
    }).classed(thisGraph.consts.selectedClass, false);
    thisGraph.state.selectedEdge = null;
  };

  GraphCreator.prototype.pathMouseDown = function (d3path, d) {
    var thisGraph = this,
      state = thisGraph.state;
    d3.event.stopPropagation();
    state.mouseDownLink = d;

    if (state.selectedNode) {
      thisGraph.removeSelectFromNode();
    }

    var prevEdge = state.selectedEdge;
    if (!prevEdge || prevEdge !== d) {
      thisGraph.replaceSelectEdge(d3path, d);
    } else {
      thisGraph.removeSelectFromEdge();
    }
  };

  // mousedown on node
  GraphCreator.prototype.circleMouseDown = function (d3node, d) {
    var thisGraph = this,
      state = thisGraph.state;
    d3.event.stopPropagation();
    state.mouseDownNode = d;
    if (d3.event.shiftKey) {
      state.shiftNodeDrag = d3.event.shiftKey;
      // reposition dragged directed edge
      thisGraph.dragLine.classed('hidden', false)
        .attr('d', 'M' + d.x + ',' + d.y + 'L' + d.x + ',' + d.y);
      return;
    }
  };

  /* place editable text on node in place of svg text */
  GraphCreator.prototype.changeTextOfNode = function (d3node, d) {
    var thisGraph = this,
      consts = thisGraph.consts,
      htmlEl = d3node.node();
    d3node.selectAll("text").remove(); // clean duplicate element information
    d3node.selectAll("div").remove();
    var nodeBCR = htmlEl.getBoundingClientRect(),
      curScale = nodeBCR.width / consts.nodeRadius,
      placePad = 5 * curScale,
      useHW = curScale > 1 ? nodeBCR.width * 0.71 : consts.nodeRadius * 1.42;
    // replace with editableconent text
    var d3txt = thisGraph.svg.selectAll("foreignObject")
      .data([d])
      .enter()
      .append("foreignObject")
      .attr("x", nodeBCR.left + placePad)
      .attr("y", nodeBCR.top + placePad)
      .attr("height", 2 * useHW)
      .attr("width", useHW)
      .append("xhtml:p")
      .attr("id", consts.activeEditId)
      .attr("contentEditable", "true")
      .text(d.title)
      .on("mousedown", function (d) {
        d3.event.stopPropagation();
      })
      .on("keydown", function (d) {
        d3.event.stopPropagation();
        if (d3.event.keyCode == consts.ENTER_KEY && !d3.event.shiftKey) {
          this.blur();
        }
      })
      .on("blur", function (d) {
        d.title = this.textContent;
        thisGraph.insertTitleLinebreaks(d3node, d.title);
        thisGraph.buttonConfig(d3node, d);
        thisGraph.showXY(d3node, d);
        d3.select(this.parentElement).remove();
      });
    return d3txt;
  };


  // mouseup on nodes
  GraphCreator.prototype.circleMouseUp = function (d3node, d) {
    var thisGraph = this,
      state = thisGraph.state,
      consts = thisGraph.consts;
    // reset the states
    state.shiftNodeDrag = false;
    d3node.classed(consts.connectClass, false);

    var mouseDownNode = state.mouseDownNode;

    if (!mouseDownNode) return;

    thisGraph.dragLine.classed("hidden", true);

    if (mouseDownNode !== d) {
      // we're in a different node: create new edge for mousedown edge and add to graph
      var newEdge = { source: mouseDownNode, target: d };
      var filtRes = thisGraph.paths.filter(function (d) {
        if (d.source === newEdge.target && d.target === newEdge.source) {
          thisGraph.edges.splice(thisGraph.edges.indexOf(d), 1);
        }
        return d.source === newEdge.source && d.target === newEdge.target;
      });
      if (!filtRes[0].length) {
        thisGraph.edges.push(newEdge);
        thisGraph.updateGraph();
      }
    } else {
      // we're in the same node
      if (state.justDragged) {
        // dragged, not clicked
        state.justDragged = false;
      } else {
        // clicked, not dragged
        if (d3.event.shiftKey) {
          // shift-clicked node: edit text content
          var d3txt = thisGraph.changeTextOfNode(d3node, d);
          var txtNode = d3txt.node();
          thisGraph.selectElementContents(txtNode);
          txtNode.focus();
        } else {
          if (state.selectedEdge) {
            thisGraph.removeSelectFromEdge();
          }
          var prevNode = state.selectedNode;

          if (!prevNode || prevNode.id !== d.id) {
            thisGraph.replaceSelectNode(d3node, d);
          } else {
            thisGraph.removeSelectFromNode();
          }
        }
      }
    }
    state.mouseDownNode = null;
    return;

  }; // end of circles mouseup

  // mousedown on main svg
  // ***** init node and data structure
  GraphCreator.prototype.svgMouseDown = function () {
    this.state.graphMouseDown = true;
  };

  // mouseup on main svg
  GraphCreator.prototype.svgMouseUp = function () {
    var thisGraph = this,
      state = thisGraph.state;
    if (state.justScaleTransGraph) {
      // dragged not clicked
      state.justScaleTransGraph = false;
    } else if (state.graphMouseDown && d3.event.shiftKey) {
      // clicked not dragged from svg
      var extraString = "stringify json?"
      var metaData = { key: "value" }

      var xycoords = d3.mouse(thisGraph.svgG.node())
      var d = { id: thisGraph.idct++, title: consts.defaultTitle, x: xycoords[0], y: xycoords[1], extraString: extraString, metaData: metaData };
      thisGraph.nodes.push(d);
      thisGraph.updateGraph();
      // console.log("create node:", d)
      // make title of text immediently editable
      var d3txt = thisGraph.changeTextOfNode(thisGraph.circles.filter(function (dval) {
        return dval.id === d.id;
      }), d)
      var txtNode = d3txt.node();
      // console.log("txtNode: ", txtNode)
      thisGraph.selectElementContents(txtNode);
      txtNode.focus(); // 选中 text
    } else if (state.shiftNodeDrag) {
      // dragged from node
      state.shiftNodeDrag = false;
      thisGraph.dragLine.classed("hidden", true);
    }
    state.graphMouseDown = false;
  };

  // keydown on main svg
  GraphCreator.prototype.svgKeyDown = function () {
    var thisGraph = this,
      state = thisGraph.state,
      consts = thisGraph.consts;
    // make sure repeated key presses don't register for each keydown
    if (state.lastKeyDown !== -1) return;

    state.lastKeyDown = d3.event.keyCode;
    var selectedNode = state.selectedNode,
      selectedEdge = state.selectedEdge;

    switch (d3.event.keyCode) {
      case consts.BACKSPACE_KEY:
      case consts.DELETE_KEY:
        // TODO: how to tracking editing mode?  
        d3.event.preventDefault(); 
        if (selectedNode) {
          thisGraph.nodes.splice(thisGraph.nodes.indexOf(selectedNode), 1);
          thisGraph.spliceLinksForNode(selectedNode);
          state.selectedNode = null;
          thisGraph.updateGraph();
        } else if (selectedEdge) {
          thisGraph.edges.splice(thisGraph.edges.indexOf(selectedEdge), 1);
          state.selectedEdge = null;
          thisGraph.updateGraph();
        }
        break;
    }
  };

  GraphCreator.prototype.svgKeyUp = function () {
    this.state.lastKeyDown = -1;
  };

  // call to propagate changes to graph
  GraphCreator.prototype.updateGraph = function () {

    var thisGraph = this,
      consts = thisGraph.consts,
      state = thisGraph.state;

    thisGraph.paths = thisGraph.paths.data(thisGraph.edges, function (d) {
      return String(d.source.id) + "+" + String(d.target.id);
    });
    var paths = thisGraph.paths;
    // update existing paths
    paths.style('marker-end', 'url(#end-arrow)')
      .classed(consts.selectedClass, function (d) {
        return d === state.selectedEdge;
      })
      .attr("d", function (d) {
        return "M" + d.source.x + "," + d.source.y + "L" + d.target.x + "," + d.target.y;
      });

    // add new paths
    paths.enter()
      .append("path")
      .style('marker-end', 'url(#end-arrow)')
      .classed("link", true)
      .attr("d", function (d) {
        return "M" + d.source.x + "," + d.source.y + "L" + d.target.x + "," + d.target.y;
      })
      .on("mousedown", function (d) {
        thisGraph.pathMouseDown.call(thisGraph, d3.select(this), d);
      }
      )
      .on("mouseup", function (d) {
        state.mouseDownLink = null;
      });

    // remove old links
    paths.exit().remove();

    // update existing nodes
    thisGraph.circles = thisGraph.circles.data(thisGraph.nodes, function (d) { return d.id; }); // targeting the data in this node
    thisGraph.circles.attr("transform", function (d) { return "translate(" + d.x + "," + d.y + ")"; }); // update the data in transform based on d.x and d.y

    // add new nodes 
    var newGs = thisGraph.circles.enter()
      .append("g");

    newGs.classed(consts.circleGClass, true)
      .attr("transform", function (d) { return "translate(" + d.x + "," + d.y + ")"; })
      .on("mouseover", function (d) {
        if (state.shiftNodeDrag) {
          d3.select(this).classed(consts.connectClass, true);
        }
      })
      .on("mouseout", function (d) {
        d3.select(this).classed(consts.connectClass, false);
      })
      .on("mousedown", function (d) {
        thisGraph.circleMouseDown.call(thisGraph, d3.select(this), d);
      })
      .on("mouseup", function (d) {
        thisGraph.circleMouseUp.call(thisGraph, d3.select(this), d);
      })
      // .on("mouseover", function (d) {
      //   var rect = d3.select(this)
      //     .attr("fill", "yellow");
      // })
      // .on("mouseout", function (d) {
      //   var rect = d3.select(this)
      //     .attr("fill", "blue");
      // })
      .call(thisGraph.drag);

    newGs.append("circle")
      .attr("r", String(consts.nodeRadius));


    // TODO: update nodes
    newGs.each(function (d) {
      thisGraph.insertTitleLinebreaks(d3.select(this), d.title);
      thisGraph.buttonConfig(d3.select(this), d);
      thisGraph.showXY(d3.select(this), d);
      console.log("create node location: ", d.x, " ++ ", d.y)
    });

    // remove old nodes
    thisGraph.circles.exit().remove();
  };

  GraphCreator.prototype.zoomed = function () {
    this.state.justScaleTransGraph = true;
    d3.select("." + this.consts.graphClass)
      .attr("transform", "translate(" + d3.event.translate + ") scale(" + d3.event.scale + ")");
  };

  GraphCreator.prototype.updateWindow = function (svg) {
    var docEl = document.documentElement,
      bodyEl = document.getElementsByTagName('body')[0];
    var x = window.innerWidth || docEl.clientWidth || bodyEl.clientWidth;
    var y = window.innerHeight || docEl.clientHeight || bodyEl.clientHeight;
    svg.attr("width", x).attr("height", y);
  };



  /**** MAIN ****/

  // warn the user when leaving
  window.onbeforeunload = function () {
    return "Make sure to save your graph locally before leaving :-)";
  };

  var docEl = document.documentElement,
    bodyEl = document.getElementsByTagName('body')[0];

  var width = window.innerWidth || docEl.clientWidth || bodyEl.clientWidth,
    height = window.innerHeight || docEl.clientHeight || bodyEl.clientHeight;

  var xLoc = width / 2 - 25,
    yLoc = 100;

  // initial node data
  var nodes = [];
  var edges = [];


  /** MAIN SVG **/
  var svg = d3.select(settings.appendElSpec).append("svg")
    .attr("width", width)
    .attr("height", height);
  var graph = new GraphCreator(svg, nodes, edges);
  graph.setIdCt(2);
  graph.updateGraph();



})(window.d3, window.saveAs, window.Blob);
