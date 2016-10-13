	var preferences = {
      "respectLimitOnePerDeck" : false,
      "enforceLimitThreePerDeck" : false,
      "corpGoToMaxSize" :  true,
      "Rare Cards" : [], // Case Matters ex: ["San San City Grid","Desperado"]
      "Uncommon Cards" : [], // Case Matters -- If not listed in uncommon & rare, then considred common.    
      "ArenaPicks" : 4,
      "runnerEconPicksMin" : 10,
      "corpEconPicksMin" : 9,
      "minDeckSize": 45,
      "corePicks":7,
      "blacklist": ["Cerebral Static","Rebirth","Indian Union Stock Exchange"],
	  "limit_cards":true
    }
    
    var corpSlotsColumn1 = ["identity", "agenda", "asset", "upgrade", "operation"];
    var corpSlotsColumn2 = ["ice"];
    
    var runSlotsColumn1 = ["identity", "event","hardware","resource"];
    var runSlotsColumn2 = ["program"];
	

    
		function DataAccess() {
		  var storageExists = false;
		  var apiSource="https://netrunnerdb.com/api/2.0/public/cards"
		  
		  try {
        var storage = window["localStorage"];
        x = '__storage_test__';
        storage.setItem(x,x)
        storage.removeItem(x);
        storageExists = true;
		  } catch(e) {
        storageExists = false;
		  }
		  
      this.notUpToDate = function(cardDB) {
        return true;
      }
		  
		  this.LoadCards = function(that, callback) {
        if (!storageExists) { 
          that.requestFromNRDB(callback);
          return;
        } else {
          var cardDB = storage.getItem("cards");
          
          if (that.notUpToDate(cardDB)) {
            that.requestFromNRDB(callback);
            return;
          }
          callback.apply(Document,cardDB);
        }
		  }
		  
		  this.requestFromNRDB = function(callback) {
        $.getJSON(apiSource, callback)
		  }
		}
    
  function Arena() {  
    var currentPicks = [];

    this.pickASide = function() {
      $("#Arena").html(
        "<div id='pickHere'><h2>Pick Your Side!</h2> <h3>Use Default ID: </h3> <a href=\"javascript:Script.sideChosen('corp',true)\">Corp</a> <a href=\"javascript:Script.sideChosen('runner',true)\">Runner</a><h3> Draft an ID: </h3> <a href=\"javascript:Script.sideChosen('corp',false)\">Corp</a> <a href=\"javascript:Script.sideChosen('runner',false)\">Runner</a></div>"        
      )
    }
    
    this.publishChoice = function(picks) {
      currentPicks = picks;
      var selected = [];
      
      $.each(picks, function (key, value) { 
        selected.push( "<a href=\"javascript:pickView.picked('"+value.code+"')\"><img class='pickImg' src='" + imageURLTemplate.replace("{code}", value.code) + "' alt='"+value.title+"'></a>" );
      });
    
      $("#Arena").html(selected.join( "" ));
      if (picks.length == 0) {
        $("#Arena").html("<div id='allDone'>Your deck is done. Take it to Jinteki and look for games named \"Arena\"</div>");
      }
    }
    
    this.picked = function(code) {
	
	card = database.winnow("code",true,"=",code).data()[0];
	
		if (card.type_code==="identity"){
		if (card.influence_limit == null){
		Script.setFactionAndInfluence("",-1);
		}else{
		
			Script.setFactionAndInfluence(card.faction_code,card.influence_limit);
			Script.setDeckSize(card.minimum_deck_size);
			Script.schedulePicks();
			}
			
		}
	if (!(Script.faction == "")){
	if (!(card.faction_code == Script.faction())){
	if (card.faction_cost >0){
	Script.setFactionAndInfluence(Script.faction(),Script.influence() - card.faction_cost);
	}
	}
	}
	
	
	
	
      DeckView.push(card);
      Script.nextPicks();
    }
  }

  function deckList(targetDiv) {
    var MyCards = {
      "size" : 0,
      "cardCounts" : {},
      "cardTitles" : {},
      "typeToCode" : {}
    };
    
    MyCards.collection = new Collection([]);
    
    this.push = function(card) {      
      
      
      $("#DeckList").html("");    
	  if (!(card.type_code=="identity")){
	   MyCards.size++;
	  }
      
     
      if (MyCards.cardCounts[card.code] == undefined) {
        MyCards.cardCounts[card.code] = 1;
        MyCards.cardTitles[card.code] = card.title;
        if (MyCards.typeToCode[card.type_code] == undefined) {
          MyCards.typeToCode[card.type_code] = [card.code];
        } else {
          MyCards.typeToCode[card.type_code ].push(card.code);
        }
      } else {
        MyCards.cardCounts[card.code] = MyCards.cardCounts[card.code] + 1;
      }
      if (preferences.limit_cards){
	  if  (MyCards.cardCounts[card.code] >= card.deck_limit){
	  Script.removeCard(card.code);
	  }
	  }
      $("#DeckHeader").html("<u>Deck ("+MyCards.size+"/"+Script.deckSize()+")</u> ")
	  if(Script.influence() < 0){
			$("#DeckList").append("<strong> Influence Remaining : <span style=\"color:red;\" >&#8734;</span></strong><br/>");
	  }else{
			$("#DeckList").append("<strong> Influence Remaining : <span style=\"color:red;\" >" + Script.influence() + "</span></strong><br/>");
	   }
      $.each(MyCards.typeToCode, function(type, code) {
        $("#DeckList").append("<strong>"+type+"</strong><br/>");
        
        for(code of MyCards.typeToCode[type]) {
          $("#DeckList").append(MyCards.cardCounts[code] + " " + MyCards.cardTitles[code] + "<br/>");
        };
        
        $("#DeckList").append("<br/>");
      });
     }
     
   
  }

  var dataAccess = new DataAccess();
  var database = {};  
  var imageURLTemplate = "";
  var pickView = new Arena();
  var DeckView = new deckList();
  var Script = new Script();
  
  var onDataAvaliable = function(data) {
    var items = [];
    database=new Collection(data.data);
    imageURLTemplate = data.imageUrlTemplate;
    Script.begin();
  }

  function Script() {  
    var sideCode = "";
	var factionCode=""
    var pool = {};
    var pickBound = preferences.ArenaPicks;
    var schedule = {};
	
    var idpool ={};
	var deckS =45;
	var inf =-1;
	var fact = "";
	
	
	this.setFactionAndInfluence = function(code, num) {
	  fact = code;
      inf = num;
	  if(num>=0){
	  pool = pool.winnow(fact,true,"inf",inf);
	  }
    }
	
	this.influence = function(){
	return inf;
	}
			
	this.faction = function(){
	return fact;
	}
   
   this.setDeckSize = function(num){
   deckS=num;
   schedule.setSize(this.deckSize());
   }
   
    this.deckSize = function() {
      return schedule.deckSize();
    }
  
    this.begin = function() {
      pickView.pickASide();
    }
    
    this.deckSize = function() {
      if (sideCode == "runner") {
        return deckS;
      } else  {
        return deckS+4;
      }
    }
	
	this.removeCard = function(code){
	pool = pool.winnow("code",false,"=",code);
	}
  
    this.sideChosen = function(_sideCode,_isDraft) {
	if (_isDraft){
      sideCode = _sideCode;
      pool = database.winnow("side_code",true,"=",sideCode).winnow("type_code",false,"=","identity").winnow("title",false,"E",preferences.blacklist);

      this.schedulePicks();
      if (sideCode=="runner"){
	      pickView.picked('00006');
	     }else{
	       pickView.picked('00005');
	  }
	  
    
	  }else{
	    sideCode = _sideCode;
		idpool = database.winnow("side_code",true,"=",sideCode).winnow("type_code",true,"=","identity").winnow("influence_limit",false,"=", null);
		
		pool = database.winnow("side_code",true,"=",sideCode).winnow("type_code",false,"=","identity");
		this.schedulePicks();
		pickView.publishChoice(idpool.randomSet(pickBound).data()); 
		
	  }
    }
  
    this.nextPicks = function() {    
      if (!schedule.picksLeft()) {
        pickView.publishChoice([]);  
        return;
      }
      
      type = this.nextPickType();
      
      console.log("Next Pick Type: "+type);
     
	
      switch(type) {
        case "rng":      
          cards = pool.winnow("type_code",false,"=","agenda").randomSet(pickBound).data();
          break;
        case "core":
          cards = pool.winnow("type_code",false,"=","agenda").winnow("pack_code",true,"=","core").randomSet(pickBound).data();
          break;
        case "economy":
          cards = pool.winnow("text",true,"[",/(ake [0-9]+\[credit\])|(ain [0-9]+\[credit\])/g)
                      .winnow("type_code",false,"=","agenda").randomSet(pickBound).data();
          break;
        case "fracter":
          cards = pool.winnow("keywords",true,"[","Fracter").randomSet(pickBound).data();
          break;
        case "decoder":
          cards = pool.winnow("keywords",true,"[","Decoder").randomSet(pickBound).data();
          break;
        case "killer":
          cards = pool.winnow("keywords",true,"[","Killer").randomSet(pickBound).data();
          break;
        case "breaker":
          cards = pool.winnow("keywords",true,"[","Icebreaker").randomSet(pickBound).data();
          break;
        case "agenda1":
          cards = pool.winnow("type_code",true,"=","agenda")
                      .winnow("agenda_points",true,"=",1).randomSet(pickBound).data();
          break;
        case "agenda2":
          cards = pool.winnow("type_code",true,"=","agenda")
                      .winnow("agenda_points",true,"=",2).randomSet(pickBound).data();
          break;
        case "agenda3":
          cards = pool.winnow("type_code",true,"=","agenda")
                      .winnow("agenda_points",true,"=",3).randomSet(pickBound).data();
          break;
        case "unique":
          cards = pool.winnow("uniqueness",true,"=",true)
                      .winnow("type_code",false,"=","agenda").randomSet(pickBound).data();
          break;
        case "hardware":
          cards = pool.winnow("type_code",true,"[","hardware").randomSet(pickBound).data();
          break;
        case "ice":
          cards = pool.winnow("type_code",true,"[","ice").randomSet(pickBound).data();
          break;
        case "high":
          cards = pool.winnow("cost",true,">",5).randomSet(pickBound).data();
          break;
        case "low":
          cards = pool.winnow("cost",true,"<",3).randomSet(pickBound).data();
          break;
        case "mid":
          cards = pool.winnow("cost",true,">",2).winnow("cost",true,"<",6).randomSet(pickBound).data();
          break;
        case "barrier":
          cards = pool.winnow("keywords",true,"[","Barrier")
                      .winnow("type_code",false,"=","agenda").randomSet(pickBound).data();
          break;
        case "codegate":
          cards = pool.winnow("keywords",true,"[","Code Gate")
                      .winnow("type_code",false,"=","agenda").randomSet(pickBound).data();
          break;          
        case "sentry":
          cards = pool.winnow("keywords",true,"[","Sentry")
                      .winnow("type_code",false,"=","agenda").randomSet(pickBound).data();
          break;
        default:
          console.log("Error: " + type + " not found");
      }
      pickView.publishChoice(cards);  
    } 
    
    this.schedulePicks = function() {
      schedule = new Schedule();
      
      if (sideCode == "runner") {
        schedule.setSize(deckS);
        for(i = 0; i < preferences.runnerEconPicksMin; i++) {
          schedule.pushPick("economy");
        }
        schedule.pushPick("fracter");
        schedule.pushPick("killer");
        schedule.pushPick("decoder");
        schedule.pushPick("hardware");
        schedule.pushPick("hardware");
        schedule.pushPick("breaker");
        schedule.pushPick("breaker");
        schedule.pushPick("unique");
        
        for(i = 0; i < preferences.corePicks; i++) {
          schedule.pushPick("core");
        }
        
        while(schedule.notFull()) {
          schedule.pushPick("rng");
        }
      } else if (sideCode == "corp") {
        schedule.setSize(deckS+4);
        for(i = 0; i < preferences.corpEconPicksMin; i++) {
          schedule.pushPick("economy");
        }
        
        points = 0;        
        agDist = [1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3]
        
        while(points < AgendaPointsNeeded()) {
          pt = agDist[Math.floor(Math.random() * agDist.length)];
          if (points + pt > AgendaPointsNeeded() + 1) {
            continue;
          }          
          schedule.pushPick("agenda"+pt);
          points += pt;
        }
        
        schedule.pushPick("barrier");
        schedule.pushPick("barrier");
        schedule.pushPick("codegate");
        schedule.pushPick("codegate");
        schedule.pushPick("sentry");
        schedule.pushPick("sentry");
        schedule.pushPick("ice");
        schedule.pushPick("ice");
        schedule.pushPick("ice");
        schedule.pushPick("ice");
        schedule.pushPick("unique");
        
        for(i = 0; i < preferences.corePicks; i++) {
          schedule.pushPick("core");
        }
        
        while(schedule.notFull()) {
          schedule.pushPick("rng");
        }
      }
    }
    
    this.nextPickType = function() {
      return schedule.popPick();
    }
    
    this.economyPick = function() {
      
    }
  }

  function AgendaPointsNeeded() {
    return (((Script.deckSize()-4) / 5) * 2)  + 2;    
  }
  
  function Schedule() {
    var sched = [];
    var size = 0;
   
	
    this.setSize = function(num) {
      size = num;
    }
    
    this.picksLeft = function() {
      console.log("Picks Left: " + sched.length);
      return sched.length > 0;
    }
    
    this.notFull = function() {
      return sched.length < size;
    }
    
    this.pushPick = function(pickCode) {
      sched.splice(Math.floor(Math.random() * sched.length),0,pickCode);      
    }
    
    this.popPick = function() {
      return sched.pop();
    }
  }
  
  
  function Collection(data) {
    var mine = data;
    
    this.data = function() {
      var copy = [];
      $.each(mine, function (key, value) { copy.push(value) })
      return copy;
    }
    
    this.randomSet = function (num) {
      var subset = [];
      var idx;
      
      $.each(mine, function (key, value) { subset.push(value) })
      
      while (subset.length > num) {
        idx = Math.random() * subset.length;
        subset.splice(idx,1);
      }
      
      return new Collection(subset);
    }
    
    this.winnow = function(winnowKey,positive,winnowOperator,winnowValue) {
      var subset = [];
      console.log("winnow: " + winnowKey + ":" +positive+":"+winnowOperator+":"+winnowValue);
      $.each(mine, function (key, value) { 
	console.log("analyzing:" + value.title);
        var keep = false;
     
        if ((value[winnowKey] == undefined) && !(winnowOperator=="inf" )) {
          return;
        }
        
        switch(winnowOperator) {
		  case "inf":
			
		
				keep =  ((value["faction_code"] == winnowKey) || (value["faction_code"] == "neutral") || (value["faction_cost"] <= winnowValue));
		
			break;
          case "=": // Equals
            keep = (value[winnowKey] == winnowValue);
            break;
          case "<": // Less Than
            keep = (value[winnowKey] < winnowValue);
            break;
          case ">": // Greater Than
            keep = (value[winnowKey] > winnowValue);
            break;
          case "E": // Key an Element Of
            keep = (winnowValue.includes(value[winnowKey]));
            break;
          case "[": // Matches a regular expression
            try {
              keep = (!!value[winnowKey]) && (value[winnowKey].search(winnowValue) >= 0);
            } catch(e) { 
              console.log("Error matching reg exp; swallowing.");
              return;
            }
            break;
        }
        
        
      console.log(positive == keep);
        if (positive == keep) {
          subset.push(value);
        }
      });
      console.log("winnowed down to: " + subset.length);
      return new Collection(subset);
    }
  }


  $(document).ready(function() {
    dataAccess.LoadCards(dataAccess,onDataAvaliable);
    console.log("document loaded");
  });