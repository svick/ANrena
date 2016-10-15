function DataAccess() {
    var storageExists = false;
    var apiSource = "https://netrunnerdb.com/api/2.0/public/cards";
    try {
        var storage = window["localStorage"];
        x = '__storage_test__';
        storage.setItem(x, x);
        storage.removeItem(x);
        storageExists = true;
    } catch (e) {
        storageExists = false;
    }
    this.notUpToDate = function (cardDB) {
        return true;
    };
    this.LoadCards = function (that, callback) {
        if (!storageExists) {
            that.requestFromNRDB(callback);
            return;
        } else {
            var cardDB = storage.getItem("cards");
            if (that.notUpToDate(cardDB)) {
                that.requestFromNRDB(callback);
                return;
            }
            callback.apply(Document, cardDB);
        }
        ;
    };
    this.requestFromNRDB = function (callback) {
        $.getJSON(apiSource, callback);
    };
}

var myCardCollection = [];
var myArenaScript = {};
var myDeckView = {};
var dataAccess = new DataAccess();

var preferences = {
    "deckSize": 45,
    "setFilter": "released",
    "econPicks": 9,
    "corePicks": 4,
    "limitOne": true,
    "limitAll": false,
    "weightCode": "influence-weights-faction-bonus",
    "pickOptions": 4,
    "draftBlockedCards": ["09053", "06025", "10073", "10083"],
    "releasedSets": ["core", "wla", "ta", "ce", "asis", "hs", "fp", "cac", "om", "st", "mt", "tc", "fal", "dt", "hap", "up", "tsb", "fc", "uao", "atr", "ts", "oac", "val", "bb", "cc", "uw", "oh", "uot", "dad", "kg", "bf", "dag", "si", "tlm", "ftm", "23s", "bm", "es"]
};


function CardCollection(data, setFilter) {
    var cardSets = {
        ids: {runner: [], corp: [], draft: []},
        runner: [],
        corp: [],
        agendas: []
    };
    var allowedSets = [];
    if (setFilter instanceof Array) {
        allowedSets = setFilter;
    } else {
        if (setFilter === "released") {
            allowedSets = preferences.releasedSets;
        }
    }

    $.each(data, function (key, value) {
        if (value["pack_code"] === "draft") {
            cardSets.ids.draft.push(value);
        } else {
            if (filterFunctions.checkAllowed(allowedSets, value)) {
                switch (value["type_code"]) {
                    case "agenda":
                        cardSets.agendas.push(value);
                        break;
                    case "identity":
                        if (value["side_code"] === "corp") {
                            cardSets.ids.corp.push(value);
                        } else {
                            cardSets.ids.runner.push(value);
                        }
                        break;
                    default:
                        if (value["side_code"] === "corp") {
                            cardSets.corp.push(value);
                        } else {
                            cardSets.runner.push(value);
                        }
                        break;
                }
            }
        }
    }
    );

    this.createSet = function (cardPoolCode, filters, count, weightCode, blackList, faction, influence, agendaPoints) {

        var cardPool = filterFunctions.getCardPool(cardSets, cardPoolCode);

        var results = [];
        var resultCodes = [];
        for (i = 0; i < 10; i++) {
            if (resultCodes.length >= count) {
                console.log("full");
                break;
            }
            var weightedArray = [];
            $.each(cardPool, function (key, value) {
                if (resultCodes.includes(value.code)) {
                    return true;
                }
                if (blackList.includes(value.code)) {
                    return true;
                }
                if (typeof filters[i] !== 'undefined') {
                    if (!filterFunctions.checkFilter(value, filters[i], agendaPoints)) {
                        return true;
                    }
                }
                if (influence >= 0) {
                    if (!((value["faction_code"] === faction) || (value["faction_cost"] <= influence))) {
                        return true;
                    }
                }
                var card_weight = filterFunctions.weight(value, weightCode, faction);
                for (j = 0; j < card_weight; j++) {
                    weightedArray.push(value.code);
                }
            });

            resultCodes = filterFunctions.getRandomCards(resultCodes, weightedArray, count - resultCodes.length);

        }
        $.each(resultCodes, function (key, value) {
            results.push(filterFunctions.getCard(cardPool, value));
        });
        return results;
    };

    this.getCard = function (cardPoolCode, cardCode) {
        return filterFunctions.getCard(filterFunctions.getCardPool(cardSets, cardPoolCode), cardCode);
    };

    this.blockJintekiCards = function () {
        $.each(cardSets.corp, function (key, value) {
            if (value.faction_code === "jinteki") {
                myArenaScript.blockCard(value.code);
            }

        });

    };


}



var views = {
    selectType: function () {
        var html = '<div class="select-container type"><h2>Select Format:</h2>';
        html += '<a class="select-box type draft-id" id="defaultIDpick" href="javascript:views.selectSide(\'draftid\')">Default ID</a>';
        html += '<a class="select-box type select-id" id = "draftIDpick" href="javascript:views.selectSide(\'selectid\')">Constructed ID</a>';
		html += '<a class="select-box type select-id" id = "draftDraftIDpick" href="">Draft ID</a>';
        html += '</div>';
        $("#Arena").html(html);

    },
    selectSide: function (formatCode) {
        var html = '<div class="select-container sides"><h2>Pick a side:</h2>';

        html += '<a class="select-box type runner' + formatCode + '"id="defaultRunner" href="javascript:views.startDraft(\'runner\',\'' + formatCode + '\')">Runner</a>';		
        html += '<a class="select-box type corp' + formatCode + '"id="defaultCorp" href="javascript:views.startDraft(\'corp\',\'' + formatCode + '\')">Corporation</a>';

        html += '</div>';
        $("#Arena").html(html);

    },
    startDraft: function (sideCode, formatCode) {
        this.loadPreferences();
        myArenaScript = new Script(sideCode, formatCode);
        dataAccess.LoadCards(dataAccess, onDataAvaliable);
        console.log("document loaded");


    },
    loadPreferences: function () {

    },
    publishChoice: function (picks, cardPoolCode) {
        currentPicks = picks;
        var selected = [];

        $.each(picks, function (key, value) {
            selected.push("<a href=\"javascript:views.picked('" + value.code + "','" + cardPoolCode + "')\"><img class='pickImg' src='" + imageURLTemplate.replace("{code}", value.code) + "' alt='" + value.title + "'></a>");
        });
        $("#Arena").html(selected.join(""));
    },
    picked: function (code, cardPoolCode) {

        card = myCardCollection.getCard(cardPoolCode, code);

        if (card.type_code === "identity") {
            if (card.influence_limit === null) {
                myArenaScript.setFactionAndInfluence("", -1);
            } else {
                myArenaScript.setFactionAndInfluence(card.faction_code, card.influence_limit);
                myArenaScript.setDeckSize(card.minimum_deck_size);
                if (card.code === "03002") {
                    myCardCollection.blockJintekiCards();
                }
            }
        } else if (card.type_code === "agenda") {
            myArenaScript.pickedAgendaPoints(card.agenda_points);
        }
        if (!(myArenaScript.faction === "")) {
            if (!(card.faction_code === myArenaScript.faction())) {
                if (card.faction_cost > 0) {
                    myArenaScript.setFactionAndInfluence(myArenaScript.faction(), myArenaScript.influence() - card.faction_cost);
                }
            }
        }
        myDeckView.push(card);
        if (card.type_code === "identity") {
            myArenaScript.schedulePicks();
        }
        myArenaScript.nextPicks();
    },
    draftDone: function () {
        $("#Arena").html("<div class=\"allDone\" >Your deck is done. Take it to Jinteki and look for games named \"Arena\"</div>");
    }
};

function deckList(targetDiv) {
    var MyCards = {
        "size": 0,
        "cardCounts": {},
        "cardTitles": {},
        "typeToCode": {}
    };



    this.push = function (card) {


        $("#DeckList").html("");
        if (!(card.type_code === "identity")) {
            MyCards.size++;
        }
        if (typeof MyCards.cardCounts[card.code] === "undefined") {
            MyCards.cardCounts[card.code] = 1;
            MyCards.cardTitles[card.code] = card.title;
            if (typeof MyCards.typeToCode[card.type_code] === "undefined") {
                MyCards.typeToCode[card.type_code] = [card.code];
            } else {
                MyCards.typeToCode[card.type_code ].push(card.code);
            }
        } else {
            MyCards.cardCounts[card.code] = MyCards.cardCounts[card.code] + 1;
        }
        if (preferences.limitAll || (preferences.limitOne && (card.deck_limit === 1))) {
            if (MyCards.cardCounts[card.code] >= card.deck_limit) {
                myArenaScript.blockCard(card.code);
            }
        }


        $("#DeckHeader").html("Deck (" + MyCards.size + "/" + myArenaScript.deckSize() + ")");
        if (myArenaScript.influence() < 0) {
            $("#DeckList").append("<br /><strong> Influence Remaining : <span style=\"color:red;\" >&#8734;</span></strong><br/>");
        } else {
            $("#DeckList").append("<br /><strong> Influence Remaining : <span style=\"color:red;\" >" + myArenaScript.influence() + "</span></strong><br/>");
        }
        $.each(MyCards.typeToCode, function (type, codes) {
            $("#DeckList").append("<strong>" + type + "</strong><br/>");

            for (k = 0; k < codes.length; k++) {
                $("#DeckList").append(MyCards.cardCounts[codes[k]] + " " + MyCards.cardTitles[codes[k]] + "<br/>");

            }
            ;

            $("#DeckList").append("<br/>");
        });
    };

}


function Script(sideCode, formatCode) {
    var schedule = new Schedule();
    var deckS = preferences.deckSize;
    var inf = -1;
    var fact = "";
    var blockedCodes = [];
    var agendaPoints = 0;
    var killedAgendaPicks = 0;
    var maxAgendaPoints = 0;
    var idCode = '';

    this.start = function () {
        myDeckView = new deckList();
        if (formatCode === "draftid") {
            blockedCodes = preferences.draftBlockedCards;
            if (sideCode === "runner") {
                views.picked('00006', "draft-id");
            } else {
                views.picked('00005', "draft-id");
            }


        } else {
            blockedCodes = [];
            if (sideCode === "runner") {
                views.publishChoice(myCardCollection.createSet("runner-id", [], preferences.pickOptions, "", [], "", -1), "runner-id");
            } else {
                views.publishChoice(myCardCollection.createSet("corp-id", [], preferences.pickOptions, "", [], "", -1), "corp-id");
            }

        }
    };


    this.setFactionAndInfluence = function (code, num) {
        fact = code;
        inf = num;
    };



    this.blockCard = function (code) {
        console.log("blocked card:" + code);
        blockedCodes.push(code);
    };

    this.influence = function () {
        return inf;
    };

    this.faction = function () {
        return fact;
    };

    this.setDeckSize = function (num) {
        deckS = num;
        schedule.setSize(this.deckSize());
    };

    this.deckSize = function () {
        return schedule.deckSize();
    };

    this.pickedAgendaPoints = function (value) {
        killedAgendaPicks = value - 1;
        agendaPoints += value;
    };

    this.deckSize = function () {
        if (sideCode === "runner") {
            return deckS;
        } else {
            return deckS + 4;
        }
    };



    this.nextPicks = function () {
        if (!schedule.picksLeft()) {
            views.draftDone();
            return false;
        }

        type = this.nextPickType();

        console.log("Next Pick Type: " + type);

        if (type === "agendas") {
            if (killedAgendaPicks > 0) {
                killedAgendaPicks -= 1;
                cards = myCardCollection.createSet(sideCode, [], preferences.pickOptions, preferences.weightCode, blockedCodes, fact, inf);
                views.publishChoice(cards, sideCode);
            } else {
                cards = myCardCollection.createSet("agendas", ["agendas"], preferences.pickOptions, preferences.weightCode, blockedCodes, fact, inf, maxAgendaPoints - agendaPoints);
                views.publishChoice(cards, "agendas");
            }
        } else {
            switch (type) {
                case "rng":
                    cards = myCardCollection.createSet(sideCode, [], preferences.pickOptions, preferences.weightCode, blockedCodes, fact, inf);
                    break;
                case "fracter":
                case "decoder":
                case "killer":
                    cards = myCardCollection.createSet(sideCode, [type, "AI", "program"], preferences.pickOptions, preferences.weightCode, blockedCodes, fact, inf);
                    break;
                case "breaker":
                    cards = myCardCollection.createSet(sideCode, ["icebreaker", "program"], preferences.pickOptions, preferences.weightCode, blockedCodes, fact, inf);
                    break;

                case "core":
                case "economy":
                case "hardware":
                case "ice":
                case "unique":
                    cards = myCardCollection.createSet(sideCode, [type], preferences.pickOptions, preferences.weightCode, blockedCodes, fact, inf);
                    break;
                case "barrier":
                case "codegate":
                case "sentry":
                    cards = myCardCollection.createSet(sideCode, [type, "ice"], preferences.pickOptions, preferences.weightCode, blockedCodes, fact, inf);
                    break;
                default:
                    console.log("Error: " + type + " not found");
            }
            views.publishChoice(cards, sideCode);
        }
    };

    this.schedulePicks = function () {
        schedule = new Schedule();

        if (sideCode === "runner") {
            schedule.setSize(deckS);

            schedule.pushPick("fracter");
            schedule.pushPick("killer");
            schedule.pushPick("decoder");
            schedule.pushPick("hardware");
            schedule.pushPick("hardware");
            schedule.pushPick("breaker");
            schedule.pushPick("breaker");
            schedule.pushPick("unique");

            for (i = 0; i < preferences.econPicks; i++) {
                if (schedule.notFull()) {
                    schedule.pushPick("economy");
                }
            }

            for (i = 0; i < preferences.corePicks; i++) {
                if (schedule.notFull()) {
                    schedule.pushPick("core");
                }
            }

            while (schedule.notFull()) {
                schedule.pushPick("rng");
            }
        } else if (sideCode === "corp") {
            schedule.setSize(deckS + 4);

            killedAgendaPicks = 0;
            agendaPoints = 0;
            maxAgendaPoints = (((deckS) / 5) * 2) + 2;

            for (i = 0; i < maxAgendaPoints; i++) {
                schedule.pushPick("agendas");
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

            for (i = 0; i < preferences.econPicks; i++) {
                if (schedule.notFull()) {
                    schedule.pushPick("economy");
                }
            }

            for (i = 0; i < preferences.corePicks; i++) {
                if (schedule.notFull()) {
                    schedule.pushPick("core");
                }
            }



            while (schedule.notFull()) {
                schedule.pushPick("rng");
            }
        }
        console.log(schedule.sched());
    };

    this.nextPickType = function () {
        return schedule.popPick();
    };


}



function Schedule() {
    var sched = [];
    var size = 0;
    var started = false;


    this.setSize = function (num) {
        size = num;
        started = true;
    };

    this.sched = function () {
        return sched;
    };

    this.picksLeft = function () {
        console.log(started);
        if (started) {
            return sched.length > 0;
        } else {
            return true;
        }
    };

    this.notFull = function () {
        return sched.length < size;
    };

    this.pushPick = function (pickCode) {
        sched.splice(Math.floor(Math.random() * sched.length), 0, pickCode);
    };

    this.popPick = function () {
        return sched.pop();
    };
}




var filterFunctions = {
    checkAllowed: function (allowedSets, card) {
        if (allowedSets.lenght === 0) {
            return true;
        }
        if (allowedSets.includes(card["pack_code"])) {
            return true;
        }
        return false;
    },
    getCard: function (cardPool, cardCode) {
        var result = null;
        $.each(cardPool, function (key, value) {
            if (value["code"] === cardCode) {
                result = value;
                return false;
            }
        });
        return result;
    },
    getRandomCards: function (resultCodes, weightedArray, max) {
        for (m = 0; m < max; m++) {
            if (weightedArray.length === 0) {
                return resultCodes;
            }
            var randomCode = weightedArray[Math.floor(Math.random() * weightedArray.length)];
            resultCodes.push(randomCode);
            for (l = weightedArray.length - 1; l >= 0; l--) {
                if (weightedArray[l] === randomCode) {
                    weightedArray.splice(l, 1);
                }
            }
        }
        return resultCodes;
    },
    getCardPool: function (cardSets, cardPool) {
        switch (cardPool) {
            case "runner":
                return cardSets.runner.slice();
            case "corp":
                return cardSets.corp.slice();
            case "runner-id":
                return cardSets.ids.runner.slice();
            case "corp-id":
                return cardSets.ids.corp.slice();
            case "agendas":
                return cardSets.agendas.slice();
            case "draft-id":
                return cardSets.ids.draft.slice();
        }
    },
    weight: function (card, weightCode, faction) {
        var weight = 1;
        switch (weightCode) {
            case "influence-weights-faction-bonus":
                if (card["faction_code"] === faction) {
                    weight = 3;
                }
            case "influence-weights":
                if (card["faction_cost"] <= 2) {
                    weight *= 3;
                }
                if ((card["faction_cost"] === 0)&& card["pack_code"]==="core" ) {
                    weight *= 3;
                }
                return weight;
            default:
                return weight;
        }
    },
    checkFilter: function (card, filter, agendaPoints) {
        switch (filter) {
            case "core":
                if (card["pack_code"] === "core") {
                    return true;
                }
                return false;
            case "economy":
                try {
                    if ((!!card["keywords"]) && (card["text"].search(/(ake [0-9]+\[credit\])|(ain [0-9]+\[credit\])/g) >= 0)) {
                        return true;
                    }
                } catch (error) {
                    console.log("Error matching regex!");
                }
                break;
            case "fracter":
            case "decoder":
            case "killer":
            case "icebreaker":
            case "barrier":
            case "codegate":
            case "sentry" :
            case "AI" :
                keyword = filter[0].toUpperCase() + filter.substring(1);
                try {
                    if ((!!card["keywords"]) && (card["keywords"].search(keyword) >= 0)) {
                        return true;
                    }
                } catch (error) {
                    console.log("Error matching regex!");
                }
                return false;
                break;
            case "agendas":
                if (card["agenda_points"] === agendaPoints) {
                    return true;
                }
                return false;
            case "unique":
                if (card["uniqueness"] === true) {
                    return true;
                }
                return false;
            case "hardware":
            case "ice":
            case "program":
                if (card["type_code"] === filter) {
                    return true;
                }
                return false;
            default:
                console.log("Error: " + filter + " not found");
                return false;
        }
    }
};
var onDataAvaliable = function (data) {
    var items = [];
    myCardCollection = new CardCollection(data.data, "released");
    imageURLTemplate = data.imageUrlTemplate;
    myArenaScript.start();
};
$(document).ready(function () {
    views.selectType();
});