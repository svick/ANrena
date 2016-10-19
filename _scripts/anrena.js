function DataAccess() {
    var storageExists = false;
    var apiSource = "https://netrunnerdb.com/api/2.0/public/cards";
    var packsApiSource = "https://netrunnerdb.com/api/2.0/public/packs";
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
    this.LoadPacks = function (that, callback) {
        if (!storageExists) {
            that.requestPacksFromNRDB(callback);
            return;
        } else {
            var packDB = storage.getItem("packs");
            if (that.notUpToDate(packDB)) {
                that.requestPacksFromNRDB(callback);
                return;
            }
            callback.apply(Document, packDB);
        }
        ;
    };
    this.requestFromNRDB = function (callback) {
        $.getJSON(apiSource, callback);
    };
    this.requestPacksFromNRDB = function (callback) {
        $.getJSON(packsApiSource, callback);
    };
}

var myCardCollection = []; // Instance of CardCollection contains all card information and generates draft picks from the available cards.
var myArenaScript = {}; // Instance of Script contains and handles the draft pick logic
var myDeckView = {}; // Instance of deckList contains and handles all picked card information
var dataAccess = new DataAccess();
var preferences = {//Global settings
    "deckSize": 45, // To be used with drafting ID
    "setFilter": "released", // default card filter can be "" for all packs "released" for released packs or an array of pack codes
    "econPicks": 9, // minimum econ picks
    "corePicks": 4, // minimun core set picks
    "limitOne": true, // if set to true all 1ofs will be removed from the pool once one of them has been selected.
    "limitAll": false, // if set to true all card will be removed from the pool once they reach their default deck limit.
    "softLimit": true, // if set to true cards will become increasingly rare each time they are picked after they reach their default deck limit,
    "consoleSoftLimit": true, // if set to true after selecting a console all others will become more rare, and it more common
    "weightCode": "influence-weights-faction-bonus", // currectly selected weighta algorithm to allow for different weight systems.
    "pickOptions": 4, //number of cards to pick from on selection screen
    "draftBlockedCards": ["09053", "06025", "10073", "10083"], //list of card codes to be banned with draft ids (Rebirth, Cerebral Static, Employe Strike and Indian 
    "releasedSets": [] // list of currectly released datapacks automatically populated
};
function CardCollection(data, setFilter) {
    /*
     * Object to manage the available cardlist
     * Contains all card information
     * After initialised by starting a draft
     *  it's data can be found in the myCardCollection instance
     */
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
    this.setWeights = function (cardPoolCode, weightCode, faction) {
        var cardPool = filterFunctions.getCardPool(cardSets, cardPoolCode);
        $.each(cardPool, function (key, value) {
            value.weight = filterFunctions.weight(value, weightCode, faction);
        });
    };

    this.multiplyWeight = function (cardPoolCode, cardCode, multiplier) {
        card = this.getCard(cardPoolCode, cardCode);
        if (typeof card["weight"] !== "undefined") {
            card.weight = Math.max(Math.floor(card.weight * multiplier), 1);
        } else {
            card.weight = 1;
        }
    };
    this.consoleSoftLimit = function (cardCode) {
        var cardPool = filterFunctions.getCardPool(cardSets, "runner");
        $.each(cardPool, function (key, value) {
            if (filterFunctions.checkFilter(value, "console")) {
                if (value.code === cardCode) {
                    myCardCollection.multiplyWeight("runner", value.code, 1.5);
                } else {
                    myCardCollection.multiplyWeight("runner", value.code, 0.5);
                }
            }
        });

    };
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
                if (typeof value["weight"] === 'undefined') {
                    value["weight"] = filterFunctions.weight(value, weightCode, faction);
                }
                for (j = 0; j < value["weight"]; j++) {
                    weightedArray.push(value.code);
                }

            });
            console.log(weightedArray);
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
    /*
     * Object to manage the visual content of the main view area (the #Arena div)
     */
    selectType: function () {
        var html = '<div class="select-container type"><h2>Select Format:</h2>';
        html += '<a class="select-box type draft-id" href="javascript:views.selectSide(\'draftid\')">Use Draft ID</a>';
        html += '<a class="select-box type select-id" href="javascript:views.selectSide(\'selectid\')">Draft An ID</a>';
        html += '</div>';
        $("#Arena").html(html);
    },
    selectSide: function (formatCode) {
        var html = '<div class="select-container sides"><h2>Pick a side:</h2>';
        html += '<a class="select-box type corp ' + formatCode + '" href="javascript:views.startDraft(\'corp\',\'' + formatCode + '\')">Corporation</a>';
        html += '<a class="select-box type runner  ' + formatCode + '" href="javascript:views.startDraft(\'runner\',\'' + formatCode + '\')">Runner</a>';
        html += '</div>';
        $("#Arena").html(html);
    },
    startDraft: function (sideCode, formatCode) {
        this.loadPreferences();
        myArenaScript = new Script(sideCode, formatCode);
        dataAccess.LoadPacks(dataAccess, onPacksDataAvaliable);
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
        pickedCard = myCardCollection.getCard(cardPoolCode, code);
        if (pickedCard.type_code === "identity") {
            if (pickedCard.influence_limit !== null) {
                myArenaScript.setDeckSize(pickedCard.minimum_deck_size);
                if (pickedCard.code === "03002") {
                    myCardCollection.blockJintekiCards();
                }
            }
        } else if (pickedCard.type_code === "agenda") {
            myArenaScript.pickedAgendaPoints(pickedCard.agenda_points);
        }
        myDeckView.push(pickedCard);
        if (pickedCard.type_code === "identity") {
            if ((pickedCard.influence_limit === null && ['00006', '00005'].includes(pickedCard.code)) || (pickedCard.influence_limit !== null)) {
                myArenaScript.schedulePicks();
            }
        }
        myArenaScript.nextPicks();
    },
    draftDone: function () {
        if (myDeckView.idCode() === '00006') {
            views.publishChoice(myCardCollection.createSet("draft-id", ["runner"], 3, "", ["00006"], "", -1), "draft-id");
        } else if (myDeckView.idCode() === '00005') {
            views.publishChoice(myCardCollection.createSet("draft-id", ["corp"], 4, "", ["00005"], "", -1), "draft-id");
        } else {
            $("#Arena").html("<div class=\"alldone\" >Your deck is done. Take it to Jinteki and look for games named \"Arena\"</div>");
        }
    }
};
function deckList(targetDiv) {
    /*
     * Object to manage the created decklist
     * Contains all selected card information
     * After initialised by starting a draft
     * it's data can be found in the myDeckView instance
     */
    var MyCards = {};
    var deckSize = 0;
    var maxInfluence = -1;
    var fact = "";
    var usedInfluence = 0;
    var allianceCodes = [];
    this.alliances = function () {
        return allianceCodes;
    };
    this.setUsedInfluence = function (value) {
        usedInfluence = value;
    };
    this.addUsedInfluence = function (value) {
        usedInfluence += value;
    };
    this.influence = function () {
        if (maxInfluence < 0) {
            return maxInfluence;
        } else {
            return maxInfluence - usedInfluence;
        }
    };
    this.faction = function () {
        return fact;
    };
    this.cards = function () {
        return MyCards;
    };
    this.idCode = function () {
        return Object.keys(MyCards["identity"])[0];
    };
    this.idCard = function () {
        return MyCards["identity"][Object.keys(MyCards["identity"])[0]];
    };
    this.print = function () {
        /* 
         * Fill the deckList container
         *  deckSize in the numbe of currently used cards while myArenaScript.deckSize() the final deck size.
         *  maxInfluence is the influence limit for the ID, for draft Id it is set to -1.
         *  usedInfluence is the amount of used influence while this.influence() returns the available influence for the deck.
         */
        $("#DeckList").html("");
        deckListHeader = "<div id=\"DeckHeader\" >";
        if (typeof this.idCard() !== "undefined") {
            deckListHeader += this.idCard().title + " (" + deckSize + "/" + myArenaScript.deckSize() + ")";
        } else {
            deckListHeader += "Deck";
        }
        deckListHeader += "</div><br/>";
        $("#DeckList").html(deckListHeader);
        if (maxInfluence < 0) {
            $("#DeckList").append("<strong> Influence Remaining : <span style=\"color:red;\" >&#8734;</span></strong><br/>");
        } else {
            $("#DeckList").append("<strong> Influence Remaining : <span style=\"color:red;\" >" + this.influence() + "</span>/" + maxInfluence + "</strong><br/>");
        }
        $.each(MyCards, function (type, cards) {
            /* 
             * loop between card type of cards used in the deck (except identity)
             * current type title in lowercase can be found in the variable type
             */
            if (type === "identity") {
                return true;
            }
            $("#DeckList").append("<strong>" + type + "</strong><br/>");
            $.each(cards, function (code, card) {
                /* 
                 * loop between all cards of a given type in the deck
                 * the object card contains all card info like in the nrdb API
                 * as well as the key count that contains the amount of times a card has been picked
                 * and the key usedInfluence that marks how much influence the copies of this card take from the deck.
                 */
                $("#DeckList").append(card["count"] + " " + card["title"] + " ");
                if (typeof card["usedInfluence"] !== "undefined") {
                    for (i = 0; i < card["usedInfluence"]; i++) {
                        $("#DeckList").append("<span style=\"color:red;\" >&#9679;</span>");
                    }
                }
                $("#DeckList").append("<br/>");
            });
            $("#DeckList").append("<br/>");
        });
    };
    this.calculateInfluence = function () {
        if (maxInfluence > 0) {
            myDeckView.setUsedInfluence(0);
            $.each(MyCards, function (type, cards) {
                $.each(cards, function (code, card) {
                    card.usedInfluence = 0;
                    if (!(card.faction_code === myDeckView.faction())) {
                        if (card.faction_cost > 0) {
                            card.usedInfluence = card.faction_cost * card.count;
                            myDeckView.addUsedInfluence(card.usedInfluence);
                        }
                    }
                });
            });
        }
    };
    this.push = function (pushedCard) {
        if (pushedCard.type_code !== "identity") {
            deckSize++;
        } else {
            MyCards["identity"] = {};
            if (pushedCard.influence_limit > 0) {
                fact = pushedCard.faction_code;
                maxInfluence = pushedCard.influence_limit;
            }
        }
        if (typeof MyCards[pushedCard.type_code] === "undefined") {
            MyCards[pushedCard.type_code] = {};
        }
        if (typeof MyCards[pushedCard.type_code][pushedCard.code] === "undefined") {
            pushedCard.count = 1;
            MyCards[pushedCard.type_code][pushedCard.code] = pushedCard;
        } else {
            MyCards[pushedCard.type_code][pushedCard.code]["count"] += 1;
        }

        if (preferences.limitAll || (preferences.limitOne && (pushedCard.deck_limit === 1))) {
            if (MyCards[pushedCard.type_code][pushedCard.code]["count"] >= pushedCard.deck_limit) {
                myArenaScript.blockCard(pushedCard.code);
            }
        }
        if (preferences.softLimit) {
            if (MyCards[pushedCard.type_code][pushedCard.code]["count"] >= pushedCard.deck_limit && pushedCard.type_code !== "identity") {
                if (pushedCard.type_code === "agenda") {
                    myCardCollection.multiplyWeight("agendas", pushedCard.code, 0.5);
                } else {
                    myCardCollection.multiplyWeight(pushedCard.side_code, pushedCard.code, 0.5);
                }
            }
        }
        if (preferences.consoleSoftLimit) {
            if (filterFunctions.checkFilter(pushedCard, "console")) {
                myCardCollection.consoleSoftLimit(pushedCard.code);
            }
        }

        this.calculateInfluence();
        this.print();
    }
    ;
}


function Script(sideCode, formatCode) {
    var schedule = new Schedule();
    var deckS = preferences.deckSize;
    var blockedCodes = [];
    var agendaPoints = 0;
    var killedAgendaPicks = 0;
    var maxAgendaPoints = 0;
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
    this.blockCard = function (code) {
        console.log("blocked card:" + code);
        blockedCodes.push(code);
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
                cards = myCardCollection.createSet(sideCode, [], preferences.pickOptions, preferences.weightCode, blockedCodes, myDeckView.faction(), myDeckView.influence());
                views.publishChoice(cards, sideCode);
            } else {
                cards = myCardCollection.createSet("agendas", ["agendas"], preferences.pickOptions, preferences.weightCode, blockedCodes, myDeckView.faction(), myDeckView.influence(), maxAgendaPoints - agendaPoints);
                views.publishChoice(cards, "agendas");
            }
        } else {
            switch (type) {
                case "rng":
                    cards = myCardCollection.createSet(sideCode, [], preferences.pickOptions, preferences.weightCode, blockedCodes, myDeckView.faction(), myDeckView.influence());
                    break;
                case "fracter":
                case "decoder":
                case "killer":
                    cards = myCardCollection.createSet(sideCode, [type, "AI", "program"], preferences.pickOptions, preferences.weightCode, blockedCodes, myDeckView.faction(), myDeckView.influence());
                    break;
                case "breaker":
                    cards = myCardCollection.createSet(sideCode, ["icebreaker", "program"], preferences.pickOptions, preferences.weightCode, blockedCodes, myDeckView.faction(), myDeckView.influence());
                    break;
                case "core":
                case "economy":
                case "hardware":
                case "ice":
                case "unique":
                    cards = myCardCollection.createSet(sideCode, [type], preferences.pickOptions, preferences.weightCode, blockedCodes, myDeckView.faction(), myDeckView.influence());
                    break;
                case "barrier":
                case "codegate":
                case "sentry":
                    cards = myCardCollection.createSet(sideCode, [type, "ice"], preferences.pickOptions, preferences.weightCode, blockedCodes, myDeckView.faction(), myDeckView.influence());
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
            myCardCollection.setWeights(sideCode, preferences.weightCode, myDeckView.faction());
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
            myCardCollection.setWeights("agendas", preferences.weightCode, myDeckView.faction());
            myCardCollection.setWeights(sideCode, preferences.weightCode, myDeckView.faction());
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
        var weight = 5;
        switch (weightCode) {
            case "influence-weights-faction-bonus":
                if (card["faction_code"] === faction) {
                    weight *= 3;
                }
            case "influence-weights":
                if (card["faction_cost"] <= 2) {
                    weight *= 3;
                }
                if ((card["faction_cost"] === 0) && card["pack_code"] === "core") {
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
            case "console":
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
            case "runner":
            case "corp":
                if (card["side_code"] === filter) {
                    return true;
                }
                return false;
            default:
                console.log("Error: " + filter + " not found");
                return false;
        }
    }
};
var onPacksDataAvaliable = function (data) {
    preferences.releasedSets = [];
    $.each(data.data, function (key, value) {
        if (new Date(value.date_release).getTime() <= new Date()) {
            preferences.releasedSets.push(value.code);
        }
    });
    dataAccess.LoadCards(dataAccess, onDataAvaliable);
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