//gbc_fgljp js extension/add-in for fgljp
//its added after gbc.js in index.html by fgljp
'use strict';
window.fgljp = new Object;
window.fgljp.navman=null;
console.log("gbc_fgljp begin");
(function() {
  var _xmlAsyncFlag=true;
  var _sessId=null;
  var _numRequest=1;
  var _cmdCount=0;
  var _source=null;
  var _useSSE=false; //use Server Side Events
  var _proto=1; //UR protocol version, ist set to 2 for GBC>=4.00
  var _procId=null;
  var _isBrowser=true;
  var _metaSeen=true;
  var urlog=function(s){};
  var mylog=function(s){};
  var tryJSONs=function(data){};
  var _debug=true;
  var _fcd_timer=null;
  var _sse_timer=null;
  var _empty_trials=0; //number of attempts to get SSE events if we have no procIds
  var _isGBC4 = true;
  var _procIds = new Map;
  var _lastMeta = null;
  if (_debug) {
    urlog=function(s) {
      //console.log("[UR] "+s);
      //alert(s.replace(/"/g, "'"));
    }
    mylog=function(s) {
      //console.log(s);
    }
    tryJSONs=function( data ) {
      if (typeof data == "object" ) {
        return JSON.stringify(data);
      }
      return data;
    }
  }
  function checkQueryParams() {
    var usp=new URLSearchParams(window.location.search);
    var useSSE=usp.get("useSSE");
    _useSSE= (useSSE=="1") ?true:false;
    _proto=window.gbcWrapper.protocolVersion;
    _isBrowser=window.gbcWrapper.isBrowser();
    mylog("_useSSE:"+_useSSE+",_proto:"+_proto+",_isBrowser:"+_isBrowser);
  }
  checkQueryParams();
  function myalert(txt) {
    console.log("alert:"+txt);
    alert(txt);
  }
  function myassert(expr,txt) {
    if (expr===false) {
      myalert(txt);
      console.trace();
    }
  }
  function getCurrentSession() {
    const ss=window.gbc.SessionService;
    return ss.getCurrent();
  }
  function getCurrentApp() {
    const sess=getCurrentSession();
    return sess.getCurrentApplication();
  }
  function getNode(id, app) {
    const theApp=Boolean(app)?app:getCurrentApp();
    return theApp.model.getNode(id);
  }
  function getProcId(app) {
    const node0=getNode(0,app);
    return node0.attribute("procId");
  }
  function isProcessing(app) {
    const node0=getNode(0,app);
    return node0.attribute("runtimeStatus")=="processing";
  }
  function isInteractive(app) {
    const node0=getNode(0,app);
    return node0.attribute("runtimeStatus")=="interactive";
  }
  function getAppName(app) {
    const node0=getNode(0,app);
    return node0.attribute("name");
  }
  function raiseProcId(procId) {
    var sess=getCurrentSession();
    var nav=sess.getNavigationManager();
    try {
      nav.__raiseProcId(procId);
    } catch(err) {
      alert("raiseProcId: "+err.message);
    }
  }
  function appFromProcId(procId) {
    var sess=getCurrentSession();
    var nav=sess.getNavigationManager();
    var app=null;
    try {
      app=nav.__appFromProcId(procId);
    } catch(err) {
      alert("appFromProcId: "+err.message);
    }
    return app;
  }
  function procIdShort(procId) {
    var idx=procId.indexOf(":");
    return procId.substring(idx+1);
  }
  var _xmlH = null;
  function getAJAXAnswer() {
    //mylog("getAJAXAnswer readyState:"+_xmlH.readyState+",status:"+_xmlH.status);  
    if (_xmlH == null) {
      //alert("no _xmlH  in getAJAXAnswer");
      return;
    }
    if (_xmlH.readyState != 4 ) {return;}
    if (_xmlH.status != 200) {
      mylog("AJAX status:"+_xmlH.status);
      _xmlH=null;
      return;
    }
    var responseText=_xmlH.responseText;
    if (_sessId==null) {
      _sessId=_xmlH.getResponseHeader("X-FourJs-Id");
      var headers = _xmlH.getAllResponseHeaders().toLowerCase();
      mylog("got session id:"+_sessId+",headers:"+headers);
      //_wcPath=_xmlH.getResponseHeader("X-Fourjs-Webcomponent");
      var srv=_xmlH.getResponseHeader("X-Fourjs-Server");
      mylog("srv:"+srv); 
      if (_useSSE && _source == null) {
        var url=getUrlBase() + "/ua/sse/"+encodeURIComponent(_sessId)+"?appId=0";
        addEventSource(url); 
      }
    }
    var req=_xmlH;
    _xmlH=null;
    /*
    if (req.getResponseHeader("X-FourJs-Closed")=="true") {
      mylog("X-FourJs-Closed seen");
      window.document.body.innerHTML="X-FourJs-Closed:The Application ended";
      return;
    }*/
    if (responseText.length==0) {
      if (!_useSSE) { //SSE: we come back from POST without any answer
        mylog("getAJAXAnswer:!!!!!!!!!!!!!!!!NO TEXT!!!!!!!!!!!!!!!!!!");
      }
    } else {
      if (_useSSE) {
        alert("getAJAXAnswer: unwanted responseText:"+responseText);
        return;
      }
      /* following the 'classic' GAS protocol */
      if (responseText.length>1000) {
        mylog("getAJAXAnswer:"+responseText.substring(0,800)+" > ... < "+responseText.substr(-200));
      } else {
        mylog("getAJAXAnswer:"+responseText);
      }
      try {
        if (!_metaSeen) {
          _metaSeen=true;
          myMeta(responseText);
        } else {
          emitReceive(responseText);
        }
      } catch (err) {
        mylog("error: "+err.message+",stack: "+err.stack);
        alert("error: "+err.message+",stack: "+err.stack);
      }
    }
  }
  function getUrlBase() {
    var l=window.location;
    var baseurl=l.protocol+"//"+l.host;
    return baseurl;
  }
  //computes the necessary URL when running via GAS protocol
  function getUrl() {
    var usp=new URLSearchParams(window.location.search);
    var appName=encodeURIComponent(usp.get("app"));
    var appId = (_procId !== null && _procId!=_sessId ) ? encodeURIComponent(_procId) : "0";
    var sessId = encodeURIComponent(_sessId)
    var url=getUrlBase()+
      ((_sessId!==null)?
       "/ua/sua/"+sessId+"?appId="+appId+"&pageId="+_numRequest++:
       "/ua/r/"+appName+"?ConnectorURI=&Bootstrap=done");
    mylog("url:"+url);
    return url;
  }
  //sends request via AJAX , in SSE mode the POST doesn't get a result back
  //instead the SSE events get any VM protocol data
  function sendAjax(events,what,recursive) {
    if (_xmlH!=null) {
      var req=_xmlH;
      mylog("abort _xmlH with: "+req.URL+","+req.EVENTS+","+req.WHAT);
      _xmlH.onreadystatechange = null;
      _xmlH.abort();
    }
    _xmlH = new XMLHttpRequest();
    //alert("sendAjax "+events+what);
    var req=_xmlH;
    var url=getUrl();
    req.open(what,url,_xmlAsyncFlag);
    req.URL=url;
    req.EVENTS=events;
    req.WHAT=what;
    req.setRequestHeader("Content-type","text/plain");
    req.setRequestHeader("Pragma","no-cache");
    req.setRequestHeader("Cache-Control","no-store, no-cache, must-revalidate");
    req.onreadystatechange = getAJAXAnswer;
    mylog('sendAjax:'+String(what)+" ev:"+events.substring(0,events.length-1)+" to:"+url);
    req.send(what=="POST"?events:undefined);
  }
  
  function sendPOST(events,procId) {
    if (Boolean(procId)) {
      _procId=procId;
    }
    sendAjax(events.trim()+"\n","POST");
    _procId=null;
  }

  function addFrontCalls() {
    if (!_isGBC4) {
      return; //no debugger frontcalls for now
    }
    window.gbc.FrontCallService.modules.debugger = {
      setactivewindow: function(procId) {
        var prev=getProcId();
        var prevAppName=getAppName();
        const anchorNode = this.getAnchorNode();
        const thisApp = anchorNode.getApplication();
        const thisProcId = getProcId(thisApp);
        console.log("setactivewindow:"+procId+",prev:"+prev+",prev appname:"+prevAppName);
        if (procId=="current") {
          procId = thisProcId;
          console.log("  set procId to:"+thisProcId);
        }
        if (procId == prev) {
          console.log(" 1no switch needed");
          clearTimeout(_fcd_timer);
          _fcd_timer=null;
        } else {
          if (_fcd_timer) {
            console.log("  _fcd_timer already set:"+_fcd_timer);
          }
          _fcd_timer=setTimeout(function() {
            const curr=getProcId();
            console.log("setactivewindow timer: curr:"+curr+",procId:"+procId);
            if (curr!=procId) {    
              if (curr==thisProcId && thisProcId!=procId && 
                isInteractive(thisApp)) {
                console.log("keep debugger on top");
              } else {
                console.log("raiseProcId:"+procId);
                raiseProcId(procId);
              }
            } else {
              console.log(" 2no switch needed");
            }
          }, 300);
        }
        return [prev];
      },
      getactivewindow: function() {
        //should return the name/procId of the current(topmost) app
        const procId = getProcId();
        console.log("getactivewindow:"+procId+",app:"+getAppName());
        return [procId];
      },
      getcurrentwindow: function() {
         //should return the procId of the debugger context
         const anchorNode = this.getAnchorNode();
         const thisApp = anchorNode.getApplication()
         const procId = getProcId(thisApp);
         const appName = getAppName(thisApp);
         console.log("getcurrentwindow gets procId:"+procId+",name:"+appName);
         return [procId];
      }
    };
  }
  function myMeta(meta) {
    mylog("myMeta:"+meta);
    var obj={nativeResourcePrefix: "___",
             meta:meta,
             forcedURfrontcalls:{},
             debugMode:1,
             logLevel:2};
    _lastMeta = meta;
    emitReady(obj);
    addGBCPatches(window.gbc);
  }
  function emitReady(metaobj) {
    //called by GBC
    window.gbcWrapper.URReady = function(o) {
      console.log("URREADY:"+JSON.stringify(o));
      var sess=getCurrentSession();
      sess.addServerFeatures(["ft-lock-file"]);
      var UCName=(_proto==2)? o.content.UCName : o.UCName;
      var UCVersion =(_proto==2)? o.content.UCVersion : o.UCVersion;
      var meta='meta Client{{name "GDC"} {UCName "'+UCName+'"} {version "'+UCVersion+'"} {host "browser"} {encapsulation "0"} {filetransfer "0"}}\n';
      myassert(_sessId!=null);
      mylog("meta:",meta);
      _procIds.set(o.procId,_lastMeta);
      mylog("  _procIds:"+[..._procIds.keys()]);
      
      
      _lastMeta = null;
      sendPOST(meta,o.procId);
    }

    //called by GBC
    window.gbcWrapper.childStart = function() {
      urlog("childStart");
    }
    window.gbcWrapper.close = function(data) {
      urlog("gbcWrapper.close:"+tryJSONs(data));
      if (typeof data=="object" && data.procId ) {
        urlog(" delete:"+data.procId+" from:" +[..._procIds.keys()]);
        _procIds.delete(data.procId)
        /*
        if (_procIds.size==0 && _source!==null ) {
          //we try to avoid requesting forever
          setTimeout(function() {
            //look again
            if (_procIds.size==0 && _source!==null ) {
              urlog("  stop SSE after last close");
              _source.close()
              _source=null;
            }
          }, 500);
        }*/
      }
    }
    window.gbcWrapper.interrupt = function(data) {
      urlog("gbcWrapper.interrupt:"+tryJSONs(data));
      sendPOST("interrupt");
    }
    window.gbcWrapper.ping = function() {
      urlog("ping");
    }
    window.gbcWrapper.processing = function(isProcessing) {
      urlog("processing: "+isProcessing);
    }
    window.gbcWrapper.showDebugger = function(data) {
      urlog("window.gbcWrapper.showDebugger:"+tryJSONs(data));
      var url = window.gbc.UrlService.currentUrl();
      url.removeQueryString("app");
      url.removeQueryString("useSSE");
      url.removeQueryString("UR_PLATFORM_TYPE");
      url.removeQueryString("UR_PLATFORM_NAME");
      url.removeQueryString("UR_PROTOCOL_TYPE");
      url.removeQueryString("UR_PROTOCOL_VERSION");
      var s=url.addQueryString("monitor", !0).toString();
      window.open(s);
    }
    window.gbcWrapper.send = function(data, options) {
      urlog("gbcWrapper.send:"+tryJSONs(data)+",options:"+tryJSONs(options));
      if (_source == null) {
        mylog("no source anymore");
        return;
      }
      var d= (_proto==2) ? data.content : data;
      var procId = (_proto==2) ? data.procId: null;
      var events="event _om "+_cmdCount+"{}{"+d+"}\n";
      _cmdCount+=1;
      sendPOST(events,procId);
    }
    window.gbcWrapper._forcedURfrontcalls= {
    "webcomponent": "*",
    "qa": ["startqa", "removestoredsettings", "getattribute", "playeventlist",
           "geterrors", "checktableishighlighted", "clicktablecell",
           "gettablecolumninfo", "gettableattributebyid","getinformation","gettablefocuscolumnrow"]
    //"qa": ["startqa", "removestoredsettings", "getattribute" ]
    };
    //for now: GBC handles all frontcalls
    window.gbcWrapper.isFrontcallURForced=function(moduleName, functionName) {
      return true;
    }
    window.gbcWrapper.frontcall = function(data, callback) {
      console.log("[gURAPI debug] frontcall(" + data + ") "+ callback);
      window._fc_callback=callback;
    };
    //not used for now
    //could be called by fgljp on another SSE channel/other tag
    window.clientfrontCallBack = function(code) {
      var fc=window._fc_callback;
      window._fc_callback=null;
      //we just pass the status here,
      //the real result is sent to the VM if GBC returns to GMI
      var error=null;
      var result="somedummyresult";
      if (code==-2 || code==-3) {
        error="failed"
        result=null;
      }
      fc({status:code ,result:result, error:error});
    }

    //signal metaobj to GBC
    window.gbcWrapper.emit("ready", metaobj);
  }
  //called by ajax/SSE
  function emitReceive(data, procId) {
    urlog("emitReceive: " + data + ",procId:" + procId);
    var d = (_proto == 2) ? { content : data, procId: procId } : data;
    window.gbcWrapper.emit("receive", d);
  }
  function emit_rn0(procId) {
    try {
      emitReceive("om 10000 {{rn 0}}\n",procId);
    } catch (err) {
      mylog("error {{rn 0}}: "+err.message+",stack: "+err.stack);
    }
  }
  //SSE events
  function addEventSource(url) {
    myassert(_source===null);
    var source = new EventSource(url);
    source.addEventListener('open', function(e) {
      mylog("EventSource openened-->");
    });
    source.addEventListener('vmclose', function(e) {
      var procId = e.lastEventId;
      mylog("SSE vmclose:'"+typeof e.data+","+e.data+"',id:"+procId);
      if (_procIds.has(procId)) {
        //ugly hack to force GBC being closed
        emit_rn0(procId);
      }
      if (e.data == "http404" ) {
        mylog("session ended, finally close source");
        closeSource();
      } else {
        reAddSource(url,true);
      }
      /* 
      //tried various gdc native stuff without success to close the app 'natively'
      window.gbcWrapper.emit("destroyEvent", { content: { message : "destroyed" }, procId: procId} );
      try {
        window.gbcWrapper.emit("nativeAction", { name: "close" });
      } catch (err) {
        mylog("error: "+err.message+",stack: "+err.stack);
      }
      try {
        window.gbcWrapper.emit("end", {procId: procId});
      } catch (err) {
        mylog("error: "+err.message+",stack: "+err.stack);
      }
      */
    });
    source.addEventListener('meta', function(e) {
      const procId=e.lastEventId;
      mylog("SSE meta:'"+typeof e.data+","+e.data+"',id:"+procId);
      var data=String(e.data);
      if (_procIds.has(procId)) {
        alert("  same procId coming in"+procId+",close old one");
        emit_rn0(procId);
      }
      reAddSource(url,false);
      myMeta(data.trim());
    });
    source.addEventListener('message', function(e) {
      var procId = e.lastEventId;
      mylog("SSE msg data:'"+e.data+"',id:"+procId);
      var data=String(e.data);
      reAddSource(url,true);
      if (data && data.length>0 ) {
        if (data.charAt(0)=="[") { //multiple lines...happens in VM http mode without encaps when processing
          var arr=JSON.parse(data);
          for(var i=0;i<arr.length;i++) {
            emitReceive(arr[i],procId);
          }
        } else {
          emitReceive(data,procId);
        }
      }
    });

    source.addEventListener('error', function(e) {
       mylog("err readyState:"+e.target.readyState);
       if (e.target.readyState == EventSource.CLOSED) {
         console.log("EventSource closed");
       }
       mylog(" close SSE due to an error(server not reachable)");
       closeSource();
    });
    _source=source;
    mylog("added eventsource at url:"+url);
  }
  function closeSource() {
    _source.close()
    _source=null;
  }
  function reAddSource(url,checkProcIds) { //needed for firefox: ignores the retry param
    //which means each SSE event causes the SSE listeners to be added again
    mylog("reAddSource: checkProcIds:"+checkProcIds+",size:"+ _procIds.size+",_sse_timer:"+_sse_timer);
    closeSource();
    clearTimeout(_sse_timer);
    _sse_timer=null;
    if (false && checkProcIds && _procIds.size==0) {
        _sse_timer=setTimeout(function() {
          if (_empty_trials<10) {
            _empty_trials++;
            mylog("reAddSource : empty trials:"+_empty_trials);
          } else {
            mylog("reAddSource: finally close eventSource");
            return;
          }
          addEventSource(url);
        }, 1000);
        mylog("did set up _sse_timer:"+_sse_timer);
    } else { //reset the counter
      mylog("clear sse_timer")
      _empty_trials=0;
      addEventSource(url);
    }
  }
  function addGBCPatchesInt(gbc) {
    var gbcP=Object.getPrototypeOf(gbc);
    var classes=gbcP.classes;
    var VMApplicationP = classes.VMApplication.prototype;
    //wrapResourcePath should mask non conform path symbols such as \ or :
    VMApplicationP.wrapResourcePath = function(path, nativePrefix, browserPrefix) {
      // if path has a scheme, don't change it
      if (!path || /^(http[s]?|[s]?ftp|data|file|font)/i.test(path)) {
        return path;
      }
      //console.log("wrapResourcePath path:"+path+",nativePrefix:"+nativePrefix+",browserPrefix:"+browserPrefix);
      //var startPath = (browserPrefix ? browserPrefix + "/" : "");
      if (nativePrefix == "webcomponents" ) {
        nativePrefix = "webcomponents/webcomponents";
      }
      var startPath = (nativePrefix ? nativePrefix + "/" : "");
      let returnPath = startPath + path;
      //console.log("returnPath:"+returnPath);
      return returnPath;
    }
    if (_isGBC4) {
    var navP = classes.VMSessionNavigationManager.prototype;
    navP.__appFromProcId=function(procId) {
       const appId = this._stackCurrentApplication.get(procId);
       let app = this._applicationLookupByProcId.get(appId);
       if (!app) {
          const stack = this._applicationStacks.get(procId);
          app = this._applicationLookupByProcId.get(stack[stack.length - 1])
       }
       return app;
    }
    navP.__raiseProcId=function(procId) {
       //ripped from VMSessionNavigationManagers rootWidget.when(context.constants.widgetEvents.click, () => ...
       //it would be preferable if that was a separately callable API
       fgljp.navman=this;
       const app = this.__appFromProcId(procId);
       if (app) {
         app.getUI().syncCurrentWindow();
       }
    }
    }
    /*
    var hSideP = classes.ApplicationHostSidebarWidget.prototype;
    hSideP.isAlwaysVisible=function() { //avoid the disturbing sidebar to steal place
      mylog("isAlwaysVisible");
      return false;
    }
    hSideP.updateResize = function(deltaX,absolute) {
      mylog("updateResize:"+deltaX+",absolute:"+absolute);
    }
    hSideP.updateResizeTimer = function() {
      mylog("updateResizeTimer");
    }
    hSideP._onTransitionEnd = function(evt) {
      mylog("_onTransitionEnd");
    }
    hSideP.setDisplayed = function(displayed) {
      mylog("setDisplayed");
    }
    hSideP.getCurrentSize = function() {
      mylog("getCurrentSize");
      return 0;
    }
    hSideP.getSideBarwidth=function() {
      mylog("getSideBarwidth1");
      return 0;
    }
    gbc.HostLeftSidebarService.enableSidebar(false);
    var sss = classes.StoredSettingsService.prototype;
    sss.getSideBarwidth=function() {
      mylog("getSideBarwidth2");
      return 0;
    }
    */
  }
  function addGBCPatches(gbc) {
    try {
      addGBCPatchesInt(gbc);
      addFrontCalls();
    } catch (err) {
      alert("addGBCPatches:"+err.message);
    }
  }
  function startWrapper() {
    mylog("gbc_fgljp startWrapper");
    sendAjax("",(_useSSE ? "POST":"GET"));
  }
  if (_debug) {
    fgljp.addGBCPatches=addGBCPatches;
    fgljp.startWrapper=startWrapper;
    fgljp.getCurrentSession=getCurrentSession;
    fgljp.getCurrentApp=getCurrentApp;
    fgljp.getNode=getNode;
    fgljp.getProcId=getProcId;
    fgljp.raiseProcId=raiseProcId;
  }
  window.gbc.ThemeService.setValue("theme-sidebar-max-width","100000px");
  _isGBC4= parseFloat(window.gbc.version)>=4.0;
  if (_isBrowser) {
    window.__gbcDefer = function (start) {//only called in "browser" mode by GBC
      mylog("__gbcDefer called in browser mode,_useSSE:"+_useSSE+",start:"+start);
      mylog("gbc ver:"+window.gbc.version+",_isGBC4:"+_isGBC4);
      if (_useSSE) {
        alert("_useSSE active, not possible to be set in browser mode");
        return;
      }
      addGBCPatches(window.gbc);
      start();
    };
  } else {
    startWrapper();
  }
})();
console.log("gbc_fgljp end");
