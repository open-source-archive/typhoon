//
// 
var M       = monad
var action  = {}
var ui      = {}
var present = {} 

var width   = 960;
var height  = 30;

//
//
var model = {
   api: 'http://localhost:8080',
   user: 'root',

   // scenario specification
   scenario: null,

   // text editor (ace)
   editor: null,
   
   // cubism context
   cubism: null
}

String.prototype.hashCode = function() {
  var hash = 0, i, chr;
  if (this.length === 0) return hash;
  for (i = 0; i < this.length; i++) {
    chr   = this.charCodeAt(i);
    hash  = ((hash << 5) - hash) + chr;
    hash |= 0; // Convert to 32bit integer
  }
  return hash;
}

//-----------------------------------------------------------------------------
//
// present
//
//-----------------------------------------------------------------------------
present.scenario = {}
present.scenario.new   = whiskers.compile($('#scenario-new-file').html())

// create empty scenario from template
present.scenario.empty = function(_)
{
   var scenario =  {
      id: null,
      title: 'No title',
      spec: null,
      urls: [],
      hosts: [],
      //
      _new: true
   }
   scenario.spec  = present.scenario.new(scenario)
   model.scenario = scenario
   return scenario
}.$_()

// set a new specification for scenario
present.scenario.spec = function(spec)
{
   var id = spec.match(/-module\((.*)\)\./i)[1]
   if (!id) 
   {
      var err = 'scenario id is not defined'
      model.editor.getSession().setAnnotations([
         {row: 0, column: 0, text: err, type: 'error'}
      ])
      throw err
   }
   if ((model.scenario.id != null) && (model.scenario.id != id))
   {
      var err = 'scenario id is not changeable'
      model.editor.getSession().setAnnotations([
         {row: 0, column: 0, text: err, type: 'error'}
      ])
      throw err
   }
   model.scenario.id   = id
   model.scenario.spec = spec
   return model.scenario
}.$_()

//-----------------------------------------------------------------------------
//
// action IO
//
//-----------------------------------------------------------------------------
action.IO = {}

action.IO.fail = function(xhr)
{
   return {code: xhr.status, text: xhr.statusText, error: xhr.responseJSON}
}

action.IO.after = function(t, json, accept, reject)
{
   setTimeout(function(){ accept(json) }, t)
}.$_()

// f: url -> IO json
action.IO.json = function(url, accept, reject)
{
   $.ajax(
      {
         url: url, 
         type: 'get', 
         dataType: 'json'
      }
   )
   .done(function(json){accept(json)})
   .fail(function(xhr){reject(action.IO.fail(xhr))})
}.$_()

// cubism data series
action.IO.series = function(sid, urn, title) 
{
   return model.context.metric(function(start, stop, step, callback) {
      d3.json(model.api + "/scenario/" + sid + "/cubism/" + encodeURIComponent(urn) 
         + "/" + start.getTime() / 1000
         + "/" + stop.getTime() / 1000 
         + "?chronon=" + step / 1000, 
         function(data) 
         {
            if (!data) return callback(new Error("unable to load data"));
            callback(null, data.map(function(x){return x[1]}))
         });
      }, title);
}

action.IO.typhoon = {}
action.IO.typhoon.profile = function(uid)
{
   return action.IO.json([model.api, 'user', uid, 'scenario'].join('/'))
}

action.IO.typhoon.get = function(id)
{
   return action.IO.json([model.api, 'scenario', id].join('/'))
}

action.IO.typhoon.lint = function(scenario, accept, reject)
{
   $.ajax(
      {
         url: [model.api, 'lint', scenario.id].join('/'),
         type: 'post',
         dataType: 'text',
         data: scenario.spec,
         headers: {'Content-Type': 'application/erlang'}
      }
   )
   .done(function(json){accept(json)})
   .fail(function(xhr){reject(action.IO.fail(xhr))})
}.$_()

action.IO.typhoon.put = function(scenario, accept, reject)
{
   $.ajax(
      {
         url: [model.api, 'scenario', scenario.id].join('/'),
         type: 'put',
         dataType: 'json',
         data: scenario.spec,
         headers: {'Content-Type': 'application/erlang'}
      }
   )
   .done(function(json){accept(json)})
   .fail(function(xhr){reject(action.IO.fail(xhr))})
}.$_()

action.IO.typhoon.remove = function(scenario, accept, reject)
{
   $.ajax(
      {
         url: [model.api, 'scenario', scenario.id].join('/'),
         type: 'delete',
         dataType: 'json'
      }
   )
   .done(function(json){accept(json)})
   .fail(function(xhr){reject(action.IO.fail(xhr))})
}.$_()

action.IO.typhoon.spawn = function(scenario)
{
   return action.IO.json([model.api, 'scenario', scenario.id, 'spawn'].join('/'))
}
action.IO.typhoon.abort = function(scenario)
{
   return action.IO.json([model.api, 'scenario', scenario.id, 'abort'].join('/'))
}

//-----------------------------------------------------------------------------
//
// action UI
//
//-----------------------------------------------------------------------------
action.UI = {}

action.UI.click = function(match, accept)
{
   $(document).on('click', match,
      function(e)
      {
         accept($(this).data())
         e.preventDefault()
      }
   )
}.$_()

action.UI.scenario = {}
action.UI.scenario.show = action.UI.click('.js-action-scenario')
action.UI.scenario.init = action.UI.click('.js-action-scenario-new')
action.UI.scenario.spec = function(accept)
{
   $('.js-scenario-spec').change(
      function(e)
      {
         if (!this.checked) 
         {
            accept(model.editor.getValue())
            $('.js-scenario-spec').prop('checked', true)
            e.preventDefault()
         }
      }
   )
}.$_()

action.UI.scenario.spawn = action.UI.click('.js-action-scenario-spawn')
action.UI.scenario.abort = action.UI.click('.js-action-scenario-abort')
action.UI.scenario.remove = action.UI.click('.js-action-scenario-remove')

//-----------------------------------------------------------------------------
//
// UI
//
//-----------------------------------------------------------------------------
ui.fail = function(x)
{
   $('.dc-loading-bar').hide()
   console.error(x)
   chain.show_error(5000, x)
}.$_()

ui.debug = function(x)
{
   console.log(x)
   return x
}.$_()

ui.progressbar = function(show, x)
{
   if (show)
      $('.dc-loading-bar').show()
   else
      $('.dc-loading-bar').hide()
   return x
}.$_()

ui.scenario = {}
ui.scenario.thumbnail = whiskers.compile($('#scenario-thumbnail').html())
ui.scenario.cubism = whiskers.compile($('#scenario-cubism').html())

ui.scenario.append = function(scenario)
{
   $('.js-scenario-thumbnail').prepend( ui.scenario.thumbnail(scenario) )
   return scenario
}.$_()

ui.scenario.list = function(list)
{
   list.forEach(ui.scenario.append)
   return list
}.$_()

ui.scenario.show = function(scenario)
{
   model.scenario = scenario

   if ('spec' in scenario)
      model.editor.setValue(scenario.spec)
   else 
      model.editor.setValue('')
   model.editor.session.selection.clearSelection()
   model.editor.scrollToLine(1, true, true, function(){})
   model.editor.gotoLine(1)

   $('.js-scenario-title').text(scenario.title)
   if (scenario._new)
      $('.js-scenario-spec').prop('checked', true)

   $('.js-scenario').show()
   return scenario
}.$_()

ui.scenario.action = function(flag, scenario)
{
   if (flag)
   {
      $('.js-action-scenario-spawn').removeClass('dc-btn--disabled')
      $('.js-action-scenario-abort').removeClass('dc-btn--disabled')
      $('.js-action-scenario-remove').removeClass('dc-btn--disabled')
   } else {
      $('.js-action-scenario-spawn').addClass('dc-btn--disabled')
      $('.js-action-scenario-abort').addClass('dc-btn--disabled')
      $('.js-action-scenario-remove').addClass('dc-btn--disabled')
   }
   return scenario
}

ui.scenario.editor = function(flag, x)
{
   $('.js-scenario-spec').prop('checked', flag)
   return x
}.$_()

ui.scenario.realtime = function(scenario)
{
   var urls  = {items: scenario.urls.map(function(x){return {title: x}})}
   $('.js-scenario-cubism-url').replaceWith( ui.scenario.cubism(urls) )

   var hosts = {items: scenario.hosts.map(function(x){return {title: x}})}
   $('.js-scenario-cubism-host').replaceWith( ui.scenario.cubism(hosts) )


      model.scenario.sensor = model.scenario.urls.map(
         function(url)
         {
            var sid = model.scenario.id
            return {
               id: url,
               series: [
                  {id: sid, urn: "urn:c:2xx+" + url, title: '2xx'}
                 ,{id: sid, urn: "urn:c:3xx+" + url, title: '3xx'}
                 ,{id: sid, urn: "urn:c:4xx+" + url, title: '4xx'}
                 ,{id: sid, urn: "urn:c:5xx+" + url, title: '5xx'}
                 ,{id: sid, urn: "urn:g:ttfb+" + url, title: 'ttfb (μs)'}
                 ,{id: sid, urn: "urn:g:ttmr+" + url, title: 'ttmr (μs)'}
               ]
            }
         }
      )

      model.scenario.sensor = model.scenario.sensor.concat(
         model.scenario.hosts.map(
         function(url)
         {
            var sid = model.scenario.id
            return {
               id: url,
               series: [
                  {id: sid, urn: "urn:g:connect+tcp" + url.substring(4), title: 'tcp (μs)'}
                 ,{id: sid, urn: "urn:g:handshake+ssl" + url.substring(4), title: 'ssl (μs)'}
                 ,{id: sid, urn: "urn:c:packet+tcp" + url.substring(4), title: 'packet / sec'}
                 ,{id: sid, urn: "urn:g:packet+tcp" + url.substring(4), title: 'packet (byte)'}
               ]
            }
         }
         )
      )

console.log(model.scenario)
   ui.cubism.init(scenario)
   ui.cubism.series(model)

   return scenario
}.$_()

ui.cubism = {}
ui.cubism.orange = ['#ffefe0','#ffd1a6','#ffba7a','#ffa54e','#ff8e25','#cc711d','#995516','#66380e']
ui.cubism.gray   = ['#f7f7f7','#ededed','#d1d1d1','#b6b6b6','#9b9b9b','#808080','#646464','#4a4a4a']
ui.cubism.green  = ['#e7ffd6','#c6ff9e','#acff70','#8bfa3c','#72e620','#65cb1c','#4a9912','#30660a']
ui.cubism.blue   = ['#e6f4ff','#d1ebff','#a3d9ff','#75c6ff','#26aafe','#1e87cb','#186698','#124365']
ui.cubism.cyan   = ['#e8fcff','#b5f5ff','#8cf0ff','#61eaff','#24e0fe','#1fb3cb','#1a8899','#145b66']
ui.cubism.yellow = ['#fff9d9','#fff09e','#ffeb7a','#ffe347','#ffda0a','#ccb116','#99840e','#665705']
ui.cubism.red    = ['#ffeae6','#ffcabf','#ff9985','#ff6c4f','#ff4a25','#cc3a1d','#992b15','#661d0e']
ui.cubism.magenta= ['#f7e9f7','#f7c8f7','#f7b2f6','#f296f1','#eb74e9','#bb5cba','#8c458b','#5d2e5c']
ui.cubism.purple = ['#f4edff','#e1cfff','#c8a6ff','#ac7afd','#9757fd','#7845cb','#5a3498','#3c2365']

ui.cubism.init = function(scenario)
{
   model.context = cubism.context()
      .step(1 * 1000)          // 1 second per value
      .size(width)
      .serverDelay(30 * 1000)  // time to collect and process metrics by server
      .clientDelay( 5 * 1000)
      .start()
 
   d3.select('.js-scenario-cubism').append("div")
      .attr("class", "rule")
      .call(model.context.rule())
  
   model.context.on("focus", 
      function(i) 
      {
         d3.selectAll(".value")
            .style("right", i == null ? null : model.context.size() - i + "px");
      }
   )
}.$_()

//
ui.cubism.vmHorizon = function(el, list)
{
   var data = list.map(
      function(x)
      {
         return action.IO.series(x.id, x.urn, x.title, x.slo)
      }
   );

   d3.select(el).selectAll(".horizon")
      .data(data, function(d){return d.toString()})
      .enter()
         .insert("div", ".bottom")
            .attr("class", "horizon")
            .call(
               model.context.horizon()
                  .colors(ui.cubism.orange.reverse().concat(ui.cubism.yellow))
                  .height( height )
                  .format(d3.format("+,.2d"))
            );
}

//
ui.cubism.series = function(model)
{
   d3.select("#series").selectAll('div')
      .data(model.scenario.urls.concat(model.scenario.hosts))
      .enter()
         .append('div')
         .attr('id', function(d){return "hash-" + d.hashCode()})
         .classed('chronolog', true)
   
   model.scenario.sensor.map(
      function(x)
      {
         var el = '#hash-' + x.id.hashCode()
         d3.select(el).selectAll("*").remove();
         d3.select(el).insert('h2').text(x.id)

         d3.select(el).selectAll(".axis")
            .data(["top", "bottom"])
            .enter().append("div")
            .attr("class", function(d) {return d + " axis"; })
            .each(function(d) { d3.select(this).call(model.context.axis().ticks(12).orient(d)); });

         ui.cubism.vmHorizon(el, x.series)

         d3.select(el).insert('hr')
      }
   )

   return model;
}.$_();


//-----------------------------------------------------------------------------
//
// chain
//
//-----------------------------------------------------------------------------
var chain = {}

chain.show_info = function(dur, text)
{
   $('.js-msg-info-text').text(text)
   $('.dc-msg--info').show()
   M.do([
      M.IO(action.IO.after(dur, null)),
      function(_)
      {
         $('.dc-msg--info').hide()
      }
   ])
}

chain.show_error = function(dur, text)
{
   $('.js-msg-error-text').text(text)
   $('.dc-msg--error').show()
   M.do([
      M.IO(action.IO.after(dur, null)),
      function(_)
      {
         $('.dc-msg--error').hide()
      }
   ])
}

chain.init_ace_editor = function()
{
   var editor = ace.edit("js-ace-editor")
   editor.setTheme("ace/theme/github")
   editor.session.setMode("ace/mode/erlang")
   editor.session.setNewLineMode("unix")
   editor.setOptions({
      enableBasicAutocompletion: true,
      enableSnippets: true
   })
   model.editor = editor
}

chain.request_user_profile = function()
{
   M.do([
      M.IO(action.IO.typhoon.profile(model.user)),
      ui.scenario.list
   ]).fail(ui.fail)
}

chain.scenario_init = function()
{
   M.do([
      M.UI(action.UI.scenario.init),
      present.scenario.empty,
      ui.scenario.show
   ])
}

chain.scenario_show = function()
{
   M.do([
      M.UI(action.UI.scenario.show),
      function(req)
      {
         return M.IO(action.IO.typhoon.get(req.scenario))
      },
      ui.scenario.show,
      ui.scenario.realtime,
      ui.scenario.action
   ]).fail(ui.fail)
}

chain.scenario_lint_and_save = function()
{
   M.do([
      M.UI(action.UI.scenario.spec),
      ui.progressbar(true),
      present.scenario.spec,
      function(scenario)
      {
         return M.IO(action.IO.typhoon.lint(model.scenario))
      },
      function(lintlog)
      {
         chain.show_info(2000, lintlog)
         return M.IO(action.IO.typhoon.remove(model.scenario))
      },
      function(_)
      {
         return M.IO(action.IO.typhoon.put(model.scenario))
      },
      function(scenario)
      {
         return ui.scenario.append(scenario)
      },
      ui.scenario.editor(false),
      ui.scenario.show,
      ui.scenario.realtime,
      ui.scenario.action,
      ui.progressbar(false)
   ]).fail(ui.fail)
}

chain.scenario_spawn = function()
{
   M.do([
      M.UI(action.UI.scenario.spawn),
      ui.progressbar(true),
      function(_)
      {
         return M.IO(action.IO.typhoon.spawn(model.scenario))
      },
      function(_)
      {
         chain.show_info(2000, "Launched " + model.scenario.n + " sessions.")
      },
      ui.progressbar(false)
   ]).fail(ui.fail)
}

chain.scenario_abort = function()
{
   M.do([
      M.UI(action.UI.scenario.abort),
      ui.progressbar(true),
      function(_)
      {
         return M.IO(action.IO.typhoon.abort(model.scenario))
      },
      function(_)
      {
         chain.show_info(2000, "Execution of scenario <" + model.scenario.id + "> is aborted.")
      },
      ui.progressbar(false)
   ]).fail(ui.fail)
}

chain.scenario_remove = function()
{
   M.do([
      M.UI(action.UI.scenario.remove),
      ui.progressbar(true),
      function(_)
      {
         return M.IO(action.IO.typhoon.remove(model.scenario))
      },
      function(_)
      {
         chain.show_info(2000, "Scenario <" + model.scenario.id + "> is removed.")
      },
      ui.progressbar(false)
   ]).fail(ui.fail)
}

//
// entry point
$(document).ready(
   function()
   {
      chain.init_ace_editor()
      chain.scenario_init()
      chain.scenario_show()
      chain.scenario_lint_and_save()
      chain.scenario_spawn()
      chain.scenario_abort()
      chain.scenario_remove()

      chain.request_user_profile()
   }
)





