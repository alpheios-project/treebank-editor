(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD. Register as an anonymous module.
    define([], factory);
  } else if (typeof exports === 'object') {
    // Node. Does not work with strict CommonJS, but
    // only CommonJS-like environments that support module.exports,
    // like Node.
    module.exports = factory();
  } else {
    // Browser globals (root is window)
    root.CTS = factory();
  }
}(this, function() {
	"use strict";

	var CTS = function() {
		return {
		}
	}
	return new CTS();
}));
(function (factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD. Register as an anonymous module.
    define(['cts'], factory);
  } else {
    factory(CTS);
  }
}(function(CTS) {
  /**
   * Just an XmlHttpRequest polyfill for different IE versions. Simple reuse of sigma.parsers.json
   *
   *
   * @param  method    {string}     HTTP Method
   * @param  url       {string}     HTTP URI to call
   * @param  callback  {?function}  Function to call when request is done.
   * @param  type      {string}     Type of data wished (default: text/xml)
   * @param  data      {?}          Data to send
   * @param  callback  {?function}  Function to call when request gave an error.
   *
   */
  var _xhr = function(method, url, callback, type, data, error_callback) {
    var xhr,
        _this = this;
    if(typeof type === "undefined") {
      type = "text/xml";
    }
    if(typeof async === "undefined") {
      async = true;
    }

    if (window && window.XMLHttpRequest) {
      xhr = new XMLHttpRequest();
    } else if(window && window.ActiveXObject) {
      var names,
          i;
    
      if (window.ActiveXObject) {
        names = [
          'Msxml2.XMLHTTP.6.0',
          'Msxml2.XMLHTTP.3.0',
          'Msxml2.XMLHTTP',
          'Microsoft.XMLHTTP'
        ];
    
        for (i in names)
          try {
            return new ActiveXObject(names[i]);
          } catch (e) {}
      }
    } else {
      return null;
    }
    try {
      xhr.open(method, url, async);

      xhr.onerror = function() {
        error_callback(xhr.status, xhr.statusText);
      }

      xhr.onreadystatechange = function() {
        if(xhr.status === 500 || xhr.status === 401 || xhr.status === 403 || xhr.status === 404) {
          error_callback(xhr.status, xhr.statusText);
        } else {
          if (xhr.readyState === 4) {
            if(typeof callback === "function") {
              if(type === "text/xml") {
                callback(xhr.responseXML);
              } else if (type == "text") {
                callback(xhr.responseText);
              }
            }
          }
        }
      };

      if((typeof data !== "undefined" || data !== null) && method === "POST") {
        xhr.overrideMimeType("multipart/form-data");
        xhr.setRequestHeader("Content-type","application/x-www-form-urlencoded;");
        xhr.send(CTS.utils.dataEncode(data));
      } else {
        xhr.send();
      }

    } catch(err) {
      console.error(err);
    }
  }

  /**
   * Return a correct endpoint url
   *
   * @param  endpoint  {string}  The CTS API endpoint
   *
   */
  var _checkEndpoint = function(endpoint) {
    if(typeof endpoint !== "string") {
      return null;
    }
    if(endpoint.slice(-1) !== "?") {
      return endpoint + "?";
    } else {
      return endpoint;
    }
  }

  /**
   * Encode data for XHR
   *
   * @param  data  {dict}  A dictionary where keys are string
   *
   */
  var _dataEncode = function(data) {
    var urlEncodedData = "",
        urlEncodedDataPairs = [];
    // We turn the data object into an array of URL encoded key value pairs.
    Object.keys(data).forEach(function(key) {
      if(Array.isArray(data[key])) {
        data[key].forEach(function(val) {
          urlEncodedDataPairs.push(encodeURIComponent(key) + "[]=" + encodeURIComponent(val));
        });
      } else {
        urlEncodedDataPairs.push(encodeURIComponent(key) + '=' + encodeURIComponent(data[key]));
      }
    });

    // We combine the pairs into a single string and replace all encoded spaces to 
    // the plus character to match the behaviour of the web browser form submit.
    urlEncodedData = urlEncodedDataPairs.join('&').replace(/%20/g, '+');
    return urlEncodedData;
  }

  var _parseInt = function(str) {
    if(typeof str === "string") { var isString = str.toLowerCase().match("[a-z]{1}"); } else { isString === null; }
    if (!isNaN(str)) {
      return parseInt(str);
    } else if (isString !== null && isString[0].length === str.length) {
      var alpha = {a:1,b:2,c:3,d:4,e:5,f:6,g:7,h:8,i:9,j:10,k:11,l:12,m:13,n:14,o:15,p:16,q:17,r:18,s:19,t:20,u:21,v:22,w:23,x:24,y:25,z:26};
      return alpha[str];
    } else {
      var array = str.toLowerCase().match("([0-9]*)([a-z]*)([0-9]*)([a-z]*)([0-9]*)");
      if(array === null) { return 0; }
      var array = array.map(
        function(substr) { 
          if(substr.length > 0 && substr != str) { return substr; };
        }
      );
      var ret = [];
      for(var i = 0; i< array.length; i++){
          if (array[i]){
            ret.push(array[i]);
        }
      }
      return ret;
    }
    return 0;
  }

  var _ValidPassage = function ($start, $end) {
    var bigger = false,
        s,
        e;
    for (var i = 0; i <= $end.length - 1; i++) {
      var s = CTS.utils.parseInt($start[i]),
          e = CTS.utils.parseInt($end[i]);
      if(Array.isArray(s) && Array.isArray(e)) {
        bigger = CTS.utils.validPassage(s, e);
        if(bigger === true) {
          break;
        }
      } else {
        if(s < e) {
          bigger = true;
          break;
        } else if( e < s ) {
          break;
        }
      }
    };
    return bigger;
  }

  var _uriParam = function() {
      var result = {},
          params = window.location.search.split(/\?|\&/);

      params.forEach( function(it) {
          if (it) {
              var param = it.split("=");
              result[param[0]] = param[1];
          }
      });

      return result;
  }

  CTS.utils = {
    xhr : _xhr,
    dataEncode : _dataEncode,
    checkEndpoint : _checkEndpoint,
    parseInt : _parseInt,
    validPassage : _ValidPassage,
    uriParam : _uriParam
  }
}));
(function (factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD. Register as an anonymous module.
    define(['cts'], factory);
  } else {
    factory(CTS);
  }
}(function(CTS) {

  /**
   * Set the value of a field
   *
   * @param  key       {string}  Field whom value has to change  
   * @param  value     {string}  New value for given field
   *
   */
  var _setValue = function (key, value) {
    this.options[key]["value"] = value;
  }

  /**
   * Return values of current object
   *
   * @return  {object}  A dictionary of key-value pair where key are field name
   *
   */
  var _getValues = function() {
    var data = {},
        _this = this;
    Object.keys(_this.options).forEach(function(key) {
      data[key] = _this.options[key]["value"] || _this.options[key]["default"];
    });
    return data;
  }

  /**
   *  Get the option of the current instance
   *
   * @return  {object}  Dictionary of pair key-object where key are field name and object contain datatype, html and default value 
   *
   */
  var _getOptions = function() {
    return this.options;
  }

  var _send = function(callback, format) {
    var _this = this;
    if (typeof format === "undefined") { format = "text/xml"; }
    //function(method, url, callback, type, async)
    CTS.utils.xhr(_this.method, _this.endpoint, function(data) {
      if(typeof callback === "function") { callback(data); }
    }, format, _this.getValues());
  }

  /**
   * LLT Tokenizer HTTP REST API
   *
   * @Github : https://github.com/latin-language-toolkit/llt
   * 
   */
  var _llt_tokenizer = function(endpoint, options) {

    return {
      method : "POST",
      endpoint : endpoint,
      options : {
        "xml" : {
          "type" : "boolean",
          "html" : "checkbox",
          "default" : true
        },
        "inline" : {
          "type" : "boolean",
          "html" : "hidden",
          "default" : true
        },
        "splitting" : {
          "type" : "boolean",
          "html" : "checkbox",
          "default" : true
        },
        "merging" : {
          "type" : "boolean",
          "html" : "checkbox",
          "default" : false
        },
        "shifting" : {
          "type" : "boolean",
          "html" : "checkbox",
          "default" : false
        },
        "text" : {
          "type" : "text", // Text unlinke string is a big thing
          "html" : "textarea"
        },
        "remove_node" : {
          "type" : "list",
          "html" : "input",
          "default" : ["teiHeader","head","speaker","note","ref"]
        },
        "go_to_root" : {
          "type" : "string",
          "html" : "input",
          "default" : "TEI"
        },
        "ns" : {
          "type" : "string",
          "html" : "input",
          "default" : "http://www.tei-c.org/ns/1.0"
        }
      },
      setValue : _setValue,
      getValues  : _getValues,
      getOptions : _getOptions,
      send : _send
    }
  }  

  /**
   *  Create a new service
   *
   *  @param
   *
   */
  var _new = function(service, endpoint, option) {
    if(typeof service === "string") {
      if(service in this._services) {
        return new this._services[service](endpoint, option);
      } else {
        throw service + " is Unknown."
      }
    } else {
      //Place holder
    }
  }
  CTS.service = {
    _services : {
      "llt.tokenizer" : _llt_tokenizer
    },
    "new" : _new
  }
}));
(function (factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD. Register as an anonymous module.
    define(['cts'], factory);
  } else {
    factory(CTS);
  }
}(function(CTS) {

  /**
   * Send an synchronous request to load a stylesheet
   *
   * @param   a_url the url of the styleshset
   *
   * @return  an XSLTProcessor with the stylesheet imported
   *
   * @throw an error upon failure to load the stylesheet
   */
  var _load = function() {
      var a_url = this.endpoint,
          req = new XMLHttpRequest();
      if (req.overrideMimeType) {
          req.overrideMimeType('text/xml');
      }
      req.open("GET", a_url, false);
      req.send(null);
      if (req.status != 200)
      {
          var msg = "Can't get transform at " + a_url;
          throw(msg);
      }
      var transformDoc = req.responseXML;
      var transformProc= new XSLTProcessor();
      transformProc.importStylesheet(transformDoc);

      this.processor = transformProc;

      return transformProc;
  }

  /**
   * Set the value of a field
   *
   * @param  key       {string}  Field whom value has to change  
   * @param  value     {string}  New value for given field
   *
   */
  var _setValue = function (key, value) {
    this.options[key]["value"] = value;
  }

  /**
   * Return values of current object
   *
   * @return  {object}  A dictionary of key-value pair where key are field name
   *
   */
  var _getValues = function() {
    var data = {},
        _this = this,
        $default;
    Object.keys(_this.options).forEach(function(key) {
      if (typeof _this.options[key]["default"] === "function") {
        $default = _this.options[key]["default"]();
      } else {
        $default = _this.options[key]["default"];
      }
      data[key] = _this.options[key]["value"] || $default;
    });
    return data;
  }

  /**
   *  Get the option of the current instance
   *
   * @return  {object}  Dictionary of pair key-object where key are field name and object contain datatype, html and default value 
   *
   */
  var _getOptions = function() {
    return this.options;
  }

  var _transform = function(xml) {
    var transformed,
        values,
        processor;
    if(!this.processor) {
      this.load();
    }
    processor = this.processor;
    if(typeof xml === "string") {
      xml = (new DOMParser()).parseFromString(xml,"text/xml");
    }
    values = this.getValues();
    Object.keys(values).forEach(function(key) {
      processor.setParameter(null, key, values[key]);
    });
    transformed = processor.transformToDocument(xml);
    return transformed;
  }

  /**
   * LLT Segtok(enization) service's output into a Treebank Annotation
   *
   * @Github : https://github.com/alpheios-project/treebank-editor/blob/master/db/xslt/segtok_to_tb.xsl
   * 
   */
  var _segtok_to_tb = function(endpoint, options) {

    return {
      endpoint : endpoint,
      processor : null,
      options : {
        "e_lang" : { 
          "type" : "string",
          "html" : "input",
          "default" : "lat"
        },
        "e_format" : { 
          "type" : "string",
          "html" : "input",
          "default" : "aldt"
        },
        "e_docuri" : { 
          "type" : "string",
          "html" : "input",
          "default" : "urn:cts:latinLit:tg.work.edition:1.1"
        },
        "e_agenturi" : { 
          "type" : "string",
          "html" : "input",
          "default" : "http://services.perseids.org/llt/segtok"
        },
        "e_appuri" : { 
          "type" : "string",
          "html" : "input",
          "default" : ""
        },
        "e_datetime" : { 
          "type" : "string",
          "html" : "hidden",
          "default" : function() { return (new Date()).toDateString(); }
        },
        "e_collection" : { 
          "type" : "string",
          "html" : "input",
          "default" : "urn:cite:perseus:lattb"
        },
        "e_attachtoroot" : { 
          "type" : "boolean",
          "html" : "checkbox",
          "default" : true
        } 
      },
      setValue : _setValue,
      getValues  : _getValues,
      getOptions : _getOptions,
      transform : _transform,
      load : _load
    }
  }  

  /**
   *  Create a new XSLT transformer object
   *
   *  @param
   *
   */
  var _new = function(xslt, endpoint, option) {
    if(typeof xslt === "string") {
      if(xslt in this.stylesheets) {
        return new this.stylesheets[xslt](endpoint, option);
      } else {
        throw xslt + " is Unknown."
      }
    } else {
      //Place holder
    }
  }
  CTS.xslt = {
    stylesheets : {
      "llt.segtok_to_tb" : _segtok_to_tb
    },
    "new" : _new
  }
}));
(function (factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD. Register as an anonymous module.
    define(['cts'], factory);
  } else {
    factory(CTS);
  }
}(function(CTS) {

  /**
   * Get the text, loading it if necessary
   *
   */
  var _getText = function() {
    return this.text;
  }

  /**
   * Set the text for the Text instance
   *
   * @param  text  {string}    Text embodied by object.urn
   *
   */
  var _setText = function(text) {
    this.text = text;
  }

  /**
   * Load the text from the endpoint
   *
   * @param  callback        {?function}    Function to call when text is retrieved
   * @param  error_callback  {?function}    Function to call when an error occured
   * @param  endpoint        {?string}      CTS API Endpoint
   *
   */
  var _retrieve = function(callback, error_callback, endpoint) {
    var _this = this,
        url;
    // If the callback is the endpoint
    if (typeof callback === "string") {
      endpoint = CTS.utils.checkEndpoint(callback);
      callback = null;
    } else if (typeof error_callback === "string") {
      endpoint = CTS.utils.checkEndpoint(error_callback);
      error_callback = null;
    } else if(typeof endpoint !== "string") {
      if(_this.endpoint === null && _this.rest !== true) {
        throw "No endpoint given";
      }
      endpoint = _this.endpoint;
    } 
    if (typeof callback !== "function") {
      callback = null;
    }

    if(_this.rest === true) {
      url = _this.urn;
    } else {
      url = endpoint + "request=GetPassage&inv=" + _this.inventory + "&urn=" + _this.urn;
    }

    try {
      CTS.utils.xhr("GET", url, function(data) {

        _this.xml = data;
        _this.document = (new DOMParser()).parseFromString(data, "text/xml");
        if(callback) { callback(data); }

      }, "text", null, error_callback);
    } catch (e) {
      if(typeof error_callback === "function") {
        error_callback(e);
      }
    }

    //And here we should load the stuff through cts.utils.ajax
  }

  /**
   * Check if the body of the XML is not empty
   *
   * @return  {boolean} Indicator of success
   *
   */
  var _checkXML = function() {
    var _this = this,
        xml;

    try {
      xml = _this.getXml("body");
      if(xml[0].children.length === 0) {
        return false;
      } else {
        return true;
      }
    } catch (e) {
      return false;
    }

  }

  /**
   *  Gets the xml using the URN
   *
   *  @param  elementName  {?string}  The name of the element to retrieve. Should be null to access format and still get whole document
   *  @param  format       {?string}  Type of data to retrieve. Default : xml. Available : xml, string
   *
   *  @return      {Document|string}  Asked dom
   *
   */
  var _getXml = function(elementName, format) {
    var _this = this,
        reconstruct = false,
        xml;

    if(typeof format !== "string" || (format !== "xml" && format !== "string")) {
      format = "xml";
    }

    //If elementName is not a string
    if(typeof elementName !== "string") {
      xml = _this.document;
    //If we have a selector, we go around by transforming the DOM into a document
    } else {
      xml = _this.document.getElementsByTagName(elementName);
      reconstruct = true;
    }

    if(format === "string") {
      var oSerializer = new XMLSerializer();
      if(reconstruct === true) {
        return [].map.call(xml, function(node) { return oSerializer.serializeToString(node); }).join("\n");
      } else {
        return oSerializer.serializeToString(xml); 
      }
    } else {
      return xml;
    }
  }

  /**
   * Create a text object representing either a passage or a full text
   *
   * @param  urn       {string}             URN identifying the text
   * @param  endpoint  {?string|boolean}    CTS API Endpoint. If false, it means the URN is a URI (Support for CTS REST)
   * @param  endpoint  {?inventory}         Inventory Identifier
   *
   */
  var _Text = function(urn, endpoint, inventory) {
    var rest = false;
    if(endpoint === false) {
      //This means we have a uri instead of a urn
      rest = true;
    }
    if(typeof endpoint !== "string") {
      endpoint = null;
    }  
    if(typeof inventory !== "string") {
      inventory = null;
    }
    return {
      //DOM
      document : null,
      //Strings
      xml : null,
      text : null,
      rest : rest,
      urn : urn,
      inventory : inventory,
      endpoint : endpoint,
      //Functions
      retrieve : _retrieve,
      setText : _setText,
      getText : _getText,
      getXml : _getXml,
      checkXML : _checkXML
    }
  }
  CTS.Text = _Text;
}));
(function (factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD. Register as an anonymous module.
    define(['cts'], factory);
  } else {
    factory(CTS);
  }
}(function(CTS) {
"use strict";

/**
 * Set the endpoint URL of the object
 *
 *  @param    {list|string}  A url for the repository
 *
 */
var _setEndpoint = function(url) {
  if(typeof url === "string") {
    this.endpoint = [url];
  } else if (typeof url === "array") {
    this.endpoint = url;
  }
}

/**
 * Set the inventories
 *
 *  @param  {dict}  A dictionary where keys are inventory's name and value a label
 *
 */

var _setInventory = function(dict) {
  this.inventory = dict;
}

/**
 * Add an inventory
 *
 *
 */
var _addInventory = function(name, label) {
  if(typeof name === "string") {
    if(typeof label === "undefined") {
      this.inventory[name] = name;
    } else {
      this.inventory[name] = label;
    }
  } else {
    throw "Name is not a string";
  }
}

/**
 * Remove an inventory
 *
 */
var _delInventory = function(name) {
  if(typeof name === "string" && name in self.inventory) {
    delete self.inventory[name];
  } else {
    throw name + " is not in known inventories."
  }
}

/**
 * Get the repository from source url
 *
 * @param  {?function}       callback        Function to call when data are loaded
 * @param  {?list}           inventory_name  Name of the inventory to load
 *
 */
var _load = function(callback, inventories) {
  var endpoint = this.endpoint, 
      callback,
      xhr = CTS.utils.xhr,
      _this = this;

  if(typeof inventories === "undefined") {
    var inventories = Object.keys(this.inventory);
  }

  //Basically if we have only the callback
  if(typeof callback === "function") {
    var callback = callback;
  } else {
    var callback = null;
  }

  xhr("GET", endpoint + "request=GetCapabilities&inv=" + inventories[0], function(data) {
    _this.inventories[inventories[0]] = new _this.TextInventory(data, _this.namespace, inventories[0]);
    if(inventories.length === 1) {
      if(callback !== null) { callback(); }
    } else {
      inventories.shift();
      _this.load(callback, inventories);
    }
  });

  return this;
}

var TextCTS3 = function(nodes, type, urn) {
  var object = {};
  object.type = type;
  object.descriptions = {};
  object.labels = {}
  object.urn = urn + "." + nodes.getAttribute("projid").split(":")[1];

  object.citations = [].map.call(nodes.getElementsByTagName("citation"), function(e) { return e.getAttribute("label") || "Unknown"; });

    // We get the labels
  [].map.call(nodes.getElementsByTagName("description"), function(groupname) {
    object.defaultLangDesc = groupname.getAttribute("xml:lang");
    object.descriptions[object.defaultLangDesc] = groupname.textContent;
  });

    // We get the labels
  [].map.call(nodes.getElementsByTagName("label"), function(labelname) {
    object.defaultLangLabel = labelname.getAttribute("xml:lang");
    object.labels[object.defaultLangLabel] = labelname.textContent;
  });

  // We create a function to have a name
  object.getDesc = function(lang) {
    if(lang === "undefined") {
      lang = this.defaultLangDesc;
    } else if (!(lang in this.descriptions)) {
      return this.descriptions[this.defaultLangDesc];
    }
    return this.descriptions[lang];
  }

  // We create a function to have a name
  object.getLabel = function(lang) {
    if(lang === "undefined") {
      lang = this.defaultLangLabel;
    } else if (!(lang in this.labels)) {
      return this.labels[this.defaultLangLabel];
    }
    return this.labels[lang];
  }

  return object;
}

var WorkCTS3 = function(nodes, urn) {
  var object = {};
  object.label = {};
  object.urn = urn + "." + nodes.getAttribute("projid").split(":")[1];

  // We get the labels
  [].map.call(nodes.getElementsByTagName("title"), function(groupname) {
    object.defaultLang = groupname.getAttribute("xml:lang");
    object.label[object.defaultLang] = groupname.textContent;
  });

  // We create a function to have a name
  object.getTitle = function(lang) {
    if(lang === "undefined") {
      lang = this.defaultLang;
    } else if (!(lang in this.label)) {
      return this.label[this.defaultLang];
    }
    return this.label[lang];
  }

  object._Translation = function(dom) { return TextCTS3(dom, "translation", object.urn)};
  object._Edition = function(dom) { return TextCTS3(dom, "edition", object.urn)};

  object.editions = [].map.call(nodes.getElementsByTagName("edition"), object._Edition);
  object.translations = [].map.call(nodes.getElementsByTagName("translation"), object._Translation);

  object.texts = object.translations.concat(object.editions);

  return object;
}

var TextGroupCTS3 = function(nodes) {
  var object = {};
  object.label = {};
  object.urn = "urn:cts:" + nodes.getAttribute("projid");

  // We get the labels
  [].map.call(nodes.getElementsByTagName("groupname"), function(groupname) {
    object.defaultLang = groupname.getAttribute("xml:lang");
    object.label[object.defaultLang] = groupname.textContent;
  });

  // We create a function to have a name
  object.getName = function(lang) {
    if(lang === "undefined") {
      lang = this.defaultLang;
    } else if (!(lang in this.label)) {
      return this.label[this.defaultLang];
    }
    return this.label[lang];
  }

  object._Work = WorkCTS3;

  object.works = [].map.call(
    nodes.getElementsByTagName("work"),
    function(node) { return object._Work(node, object.urn); }
  );

  return object;
}

var TextInventoryCTS3 = function (xml, namespace, uri) {
  var object = {},
      ti;

  object.identifier = uri;
  object.namespace = namespace;
  ti = xml.getElementsByTagNameNS(object.namespace, "TextInventory");

  object._TextGroup = TextGroupCTS3;

  if(ti.length == 1) {
    object.textgroups = [].map.call(ti[0].getElementsByTagNameNS(object.namespace, "textgroup"), object._TextGroup);
  } else {
    object.textgroups = [];
  }

  object.getRaw = function(lang, theoretical) {
    if(typeof theoretical === "undefined") {
      theoretical = false;
    }
    var r = {};
    object.textgroups.forEach(function(tg) {
      var tgLabel = tg.getName(lang);
      r[tgLabel] = {};
      tg.works.forEach(function(w) {
        var wLabel = w.getTitle(lang);
        r[tgLabel][wLabel] = {"edition" : {}, "translation" : {}};
        w.editions.forEach(function(e) {
          r[tgLabel][wLabel]["edition"][e.getLabel(lang)] = e;
        });
        w.translations.forEach(function(t) {
          r[tgLabel][wLabel]["translation"][t.getLabel(lang)] = t;
        });
        if(theoretical === true) {
          r[tgLabel][wLabel]["theoretical"] = {};
          r[tgLabel][wLabel]["theoretical"][wLabel] = w;
        }
      });

    });
    return r;
  }


  return object;
}

// Creating namespace for the retriever.
function repository(endpoint, version, namespace) {
  var object = {};
    // We check the validity of the CTS version
    if(typeof version === "undefined" || (version !== 3 && version !== 5)) {
      version = 3;
    }
    if(typeof namespace === "undefined") {
      if(version === 3) {
        object.namespace = "http://chs.harvard.edu/xmlns/cts3/ti";
      } else {
        object.namespace = "http://chs.harvard.edu/xmlns/cts";
      }
    }
    object.version = version;
    object.endpoint = endpoint;
    object.inventories = {}; // Dictionaries of inventory object
    object.inventory = {}; // Dictionaries of inventory's label
    object.setEndpoint = _setEndpoint;
    object.addInventory = _addInventory;
    object.setInventory = _setInventory;
    object.delInventory = _delInventory;
    object.load = _load;

    if (object.version === 3) {
      object.TextInventory = TextInventoryCTS3;
    } else {
      object.TextInventory = null; // NotImplementedYet
    }
    

    return object;
}

  CTS.repository = repository;
}));
(function (factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD. Register as an anonymous module.
    define(['cts'], factory);
  } else {
    factory(CTS);
  }
}(function(CTS) {
  "use strict";

  var _translate = function(word, lang) {
    if(typeof lang === "undefined" || !(lang in CTS.lang.lexicons)) {
      lang = "en";
    }
    if(word in CTS.lang.lexicons[lang]) {
      return CTS.lang.lexicons[lang][word];
    }
    return CTS.lang.lexicons["en"][word];

  }

  CTS.lang = {
    get : _translate,
    lexicons : {}
  }
}));
(function (factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD. Register as an anonymous module.
    define(['cts'], factory);
  } else {
    factory(CTS);
  }
}(function(CTS) {
  "use strict";

  var $words = {
/*
    Repository translations
*/
    "translation" : "Translation",
    "edition" : "Edition",
    "theoretical" : "Theoretical Work",
    "select" : "Select",
/*
    Passage selector
*/
    "start_passage" : "Beginning of passage", //For passage
    "stop_passage" : "End of passage", //For passage
    "retrieve_passage" : "Retrieve passage",
    "loading" : "Loading...",
/*
    LLT.TOKENIZER translations
*/
    "llt.tokenizer" : "Tokenizer parameters",
    "llt.tokenizer.xml" : "XML Formatted input",
    "llt.tokenizer.inline" : "?",
    "llt.tokenizer.splitting" : "Split Enclytics",
    "llt.tokenizer.merging" : "Merge split words",
    "llt.tokenizer.shifting" : "Shift Enclytics",
    "llt.tokenizer.text" : "Text to tokenize",
    "llt.tokenizer.remove_node" : "Nodes to remove from XML",
    "llt.tokenizer.go_to_root" : "Name of the root node",
    "llt.tokenizer.ns" : "Namespace of the XML",
/*
    LLT.Segtok_to_tb XSLT translations
*/
    "llt.segtok_to_tb" : "Treebank Parameters",
    "llt.segtok_to_tb.e_lang" : "Language",
    "llt.segtok_to_tb.e_format" : "Treebank grammar",
    "llt.segtok_to_tb.e_docuri" : "Document URI",
    "llt.segtok_to_tb.e_agenturi" : "Agent URI",
    "llt.segtok_to_tb.e_appuri" : "Application URI",
    "llt.segtok_to_tb.e_datetime" : "Date",
    "llt.segtok_to_tb.e_collection" : "Collection",
    "llt.segtok_to_tb.e_attachtoroot" : "Attach to the root", 
  }

  CTS.lang.lexicons["en"] = $words;
}));