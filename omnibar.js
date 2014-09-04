var omnibar = null;
var tabId = null;
var port = null;

Omnibar = (function () {

	Omnibar = function() {
		var omnibarUI = document.createElement("div");
		omnibarUI.innerHTML = "<div id=\"fuzzy-search-omnibar\" class=\"reset\">\n  <div class=\"reset omnibarSearchArea\">\n    <input type=\"text\" class=\"reset\">\n  </div>\n  <ul class=\"reset\"></ul>\n</div>";
		omnibarUI.style.display = "none";
		document.body.appendChild(omnibarUI);

		this.box = omnibarUI;
		this.input = document.querySelector("#fuzzy-search-omnibar input");
		var _this = this;
		this.input.addEventListener("input", function() {
			_this.sendSearchMessage();
		});
		this.completionList = document.querySelector("#fuzzy-search-omnibar ul");
		this.completionList.style.display = "none";
	};

	Omnibar.prototype.searchSpace = "none";

	Omnibar.prototype.completions = [];

	Omnibar.prototype.selection = -1;

	Omnibar.prototype.initialSelectionValue = -1;

	Omnibar.prototype.show = function(searchSpace) {
		this.box.style.display = "block";
		this.input.value = "";
		this.completionList.style.display = "none";
		this.searchSpace = searchSpace;
		this.input.focus();
		if( searchSpace == "all" ) {
			this.initialSelectionValue = -1;
		} else {
			this.initialSelectionValue = 0;
		}
		this.selection = -1;
		this.sendSearchMessage();
	};

	Omnibar.prototype.hide = function() {
		this.box.style.display = "none";
		this.input.blur();
		if( port == null ) {
			console.log("No port defined when hiding the omnibar");
			return;
		}
		port.postMessage({
			type: "hideOmnibar"
		});
	};

	Omnibar.prototype.isOpen = function () {
		return this.box.style.display == "block";
	}

    Omnibar.prototype.populateUiWithCompletions = function(results) {
    	if( this.box.style.display != "block" ) {
    		return;
    	}
    	this.completions = results;
		this.completionList.innerHTML = this.completions.map(function(completion) {
			return "<li>" + completion.html + "</li>";
		}).join("");
		this.completionList.style.display = this.completions.length > 0 ? "block" : "none";
		this.selection = Math.min(Math.max(this.initialSelectionValue, this.selection), this.completions.length - 1);
		this.updateSelection();
    };

    Omnibar.prototype.updateSelection = function () {
    	for(var i = 0 ; i < this.completionList.children.length ; i++) {
    		this.completionList.children[i].className = (i === this.selection ? "omnibarSelected" : "");
    	}
    }

    Omnibar.prototype.sendSearchMessage = function () {
    	if( port == null ) {
    		console.log("No port defined when sending search message", {input: this.input.value.trim(), searchIn: this.searchSpace});
    		return;
    	}
    	port.postMessage({
			type: "showOmnibar",
			input: this.input.value.trim(),
			searchIn: this.searchSpace,
			tabId: tabId
		});
    }

    Omnibar.prototype.openSelectedUrl = function (openInNewTab, focusTab) {
    	if( port == null ) {
    		console.log("No port defined when opening an url");
    		return;
    	}
		if( this.searchSpace == "tabs" && this.selection >= 0 ) {
			port.postMessage({
				type: "switchTabs",
				id: this.completions[this.selection].id
			});
		} else {
			var url = (this.selection >= 0 ? this.completions[this.selection].url : this.input.value.trim());
			if( url.indexOf("javascript:") === 0 ) {
			  script = document.createElement('script');
			  script.textContent = decodeURIComponent(this.completions[this.selection].url.slice("javascript:".length));
			  (document.head || document.documentElement).appendChild(script);
			} else {
	    		port.postMessage({
	    			type: "openUrl",
	    			url: url,
	    			openInNewTab: openInNewTab,
	    			focus: focusTab
	    		});
	    	}
    	}
    	if( focusTab ) {
			this.hide();
		}
    }

    Omnibar.prototype.closeSelectedTab = function () {
    	if( port == null ) {
    		console.log("No port defined when closing a tab");
    	}
    	if( this.searchSpace == "tabs" ) {
    		port.postMessage({
    			type: "closeTab",
    			id: this.completions[this.selection].id
    		});
    	}
    }

    Omnibar.prototype.editSelectedUrl = function () {
    	if( this.selection >= 0 ) {
    		this.input.value = this.completions[this.selection].url;
    		this.selection = this.initialSelectionValue;
    		this.sendSearchMessage();
    	}
    }

    return Omnibar;
})();
