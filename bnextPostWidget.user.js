// ==UserScript==
// @name           BNext Post Widget
// @description    Adds BBCode support for [post] for Bungie.net forum posts
// @namespace      Greased Lemur Studios
// @author         Krimm
// @include        http://www.bungie.net/*
// @version        0.9
// ==/UserScript==

init = function () {
    var profileUrlRoot = 'http://www.bungie.net/en/view/profile/index#!page=index&mid=';
    var postUrlRoot = 'http://www.bungie.net/en/Forum/Post?id=';
    var reqUrlRoot = 'http://www.bungie.net/Platform/Forum/GetPostAndParent/';

    // Used in a decision table when constructing the date tag for the BNext post
    var months = [
        "Jan", "Feb", "Mar", "Apr",
        "May", "Jun", "Jul", "Aug",
        "Sep", "Oct", "Nov", "Dec"
    ];
	
	var insertedTopics = {};

    BNextPostWidget = function (container, remoteId) {
        // Object members
        this.postId = remoteId;
        // Parent element reference and BNext Post wrapper elements
        this.postCont = container;
        this.toggleLink = null;
        this.bnextPostDiv = null;

        if (!this.insertPlaceholder()) {
            return null;
        }

        if (Utility) {
            this.bbDecoder = Utility.parseBBCode;
        }

		this.showPostCallback = function () {
            getAndInsertBnextPost(self);
        };
		
        this.toggleLink = document.getElementById('bnext-post-toggle-' + this.postId);
        this.bnextPostDiv = document.getElementById('bnext-post-' + this.postId);

        // This is a bit hacky, but it was the most direct way I could find
        // to have a reference to the callback on this object that can be
        // successfully unbound later
        var self = this;
        this.bind(this.toggleLink, 'click', self.showPostCallback);
    };

    BNextPostWidget.prototype = {

        // Inserts placeholder elements for the post in quesiton, and binds a
        // click handler responsible for loading in the post at user's request.
        // Designed with the idea that a single post may embed multiple other posts.
        insertPlaceholder: function () {
            var htmlStr = this.postCont.innerHTML.toString();

            //set up a regexp for this SPECIFIC post bbtag, keyed by the ID
            var postPattern = new RegExp("\\[post id='" + this.postId + "'\\s?\\](.+)\\[\\/post\\]", 'i');

            var found = postPattern.exec(this.postCont.textContent);
            if (!found) {
                return false;
            }
            var newTag = "<a id='bnext-post-toggle-$' class='remote-post' href='javascript:void(0)' data-embedded-post-id='$'>".replace(/\$/g, this.postId);
            newTag += found[1];
            newTag += "</a>";
            newTag += "<p style='display:none' id='bnext-post-$'></p>".replace('\$', this.postId);

            htmlStr = htmlStr.replace(postPattern, newTag);

            this.postCont.innerHTML = htmlStr;
            return true;
        },

        // Rendering logic for the BNex Post. Renders the post with a similar format
        // to native posts, wrapped inside a blockquote for clarity. Also creates
        // simple user controls allowing the user to toggle the visibility state of
        // the post if desired.
        insertBnextPost: function (json) {

            var profile = json.authors[0];
            var post = json.results[0];

            if (this.bnextPostDiv) {
                var postWrapper = this.bnextPostDiv.appendChild(document.createElement('blockquote'));
                postWrapper.appendChild(this.createAvatarLinkNode(profile));

                var contentDiv = postWrapper.appendChild(document.createElement('div'));
                contentDiv.className = 'content';
                contentDiv.appendChild(this.createProfileLinkNode(profile));
                contentDiv.appendChild(this.createPostTimeStampNode(post));
                contentDiv.appendChild(document.createElement('br'));
                contentDiv.appendChild(this.createPostLinkNode(post));
                contentDiv.appendChild(document.createElement('br'));
                contentDiv.appendChild(document.createElement('br'));
                contentDiv = postWrapper.appendChild(document.createElement('div'));

                // Generally try to avoid using the innerHTML property like this, but the post
                // body returned is HTML encoded, and this is the most direct way to handle
                // rendering the post body in a human readable format.       
                if (this.bbDecoder) {
                    // if a bbDecoder has been registered, process the text
                    // and get the bbdecoded text. By default the bbDecoder will attempt
                    // to be set to the bnet.base.Utility.parseBBCode function
                    contentDiv.innerHTML = this.bbDecoder(post.body);
                } else {
                    contentDiv.innerHTML = post.body;
                }

                contentDiv.appendChild(document.createElement('br'));
                contentDiv.appendChild(this.createPostLinkNode(post));

                var closeLink = contentDiv.appendChild(document.createElement('a'));
                closeLink.style.cssFloat = 'right';
                closeLink.href = 'javascript:(0)';
                closeLink.textContent = 'Close';

                var self = this;
                this.unbind(this.toggleLink, 'click', self.showPostCallback);

                this.bind(this.toggleLink, 'click', function () { toggleBnextPost(self); });
                this.bind(closeLink, 'click', function () { toggleBnextPost(self); });

                toggleBnextPost(self);
            } 
        },

        // Responsible for building the elements required to render the BNext Post
        // author's avatar on the page, with a link to the author's profile
        createAvatarLinkNode: function (profile) {
            var avatarLink = document.createElement('a');
            avatarLink.className = 'avatar';
            avatarLink.href = profileUrlRoot + profile.membershipId;
            avatarLink = avatarLink.appendChild(document.createElement('img'));
            avatarLink.setAttribute('data-membership-id', profile.membershipId);
            avatarLink.src = profile.profilePicturePath;

            return avatarLink.parentNode;
        },

        // Responsible for building the elements required to render the BNext Post
        // author's display name on the page, with a link to the author's profile
        createProfileLinkNode: function (profile) {
            var profLink = document.createElement('h1');
            profLink = profLink.appendChild(document.createElement('a'));
            profLink.textContent = profile.displayName;
            profLink.href = profileUrlRoot + profile.membershipId;

            return profLink.parentNode;
        },

        createPostLinkNode: function () {
            var postLink = document.createElement('a');
            postLink.href = postUrlRoot + this.postId;
            postLink.textContent = 'Original Post';

            return postLink;
        },


        createPostTimeStampNode: function (post) {
            //create the parent element
            var timeStampSpan = document.createElement('span');
            timeStampSpan.style.cssFloat = 'right';

            //begin processing the date information
            var createdAt = new Date(post.creationDate);
            var editedAt = new Date(post.lastModified);

            if (editedAt.getMilliseconds > createdAt.getMilliseconds) {
                timeStamp.textContent = 'Edited: ';
                timeStamp.className = 'editedTime';
            }

            //format the date string to look like this:
            // Edited: Mar 27 at 12:08:44 PM
            var timeStamp = months[editedAt.getMonth()] + " " + editedAt.getDate();
            var mins = editedAt.getMinutes().toString();
            var sec = editedAt.getSeconds().toString();
            var period = editedAt.getUTCHours() > 12 ? 'PM' : 'AM';

            //could have used splice here but felt this was just as good.
            //makes sure no single digit values are rendered for mintues
            //or seconds
            mins = (mins.length > 1) ? mins : '0' + mins;
            sec = (sec.length > 1) ? sec : '0' + sec;

            //finishes up concatenating the date values
            timeStamp += " at " + editedAt.getHours() + ":" + mins + ":" + sec;
            timeStamp += " " + period;

            //create the 'time' HTML node and populate it
            var timeNode = timeStampSpan.appendChild(document.createElement('time'));
            timeNode.setAttribute('datetime', post.lastModified);
            timeNode.textContent = timeStamp;

            return timeStampSpan;
        },

        bind: function (element, type, handler) {
            if (element.addEventListener) {
                element.addEventListener(type, handler, false);
            } else {
                element.attachEvent('on' + type, handler);
            }
        },

        unbind: function (element, type, handler) {
            if (element.removeEventListener) {
                element.removeEventListener(type, handler);
            }
        }

    };

    // Makes an AJAX request to Bungie.net to retreive the post data, then
    // renders the post with a format similar to native posts, but contained
    // within a blockquote for clarity
    var getAndInsertBnextPost = function (bnextPost) {
        bungieNetPlatform.forumService.GetPostAndParent(bnextPost.postId, false, function (json) { bnextPost.insertBnextPost(json); }, null);
    };

    var toggleBnextPost = function (bnextPost) {
        if (bnextPost.bnextPostDiv.style.display === 'none') {
            bnextPost.toggleLink.style.display = 'none';
            bnextPost.bnextPostDiv.style.display = 'block';
        } else {
            bnextPost.toggleLink.style.display = 'block';
            bnextPost.bnextPostDiv.style.display = 'none';
        }
    };

};

bootstrap = function () {
    var lastProcessedNode, lastNumPosts;
    var pattern = /\[post id='(\d+)'\s?\].+\[\/post]/i;
    var lastNumPosts = 0;

    var replacePostsOnPageLoop = function () {

        var postsOnPage = document.getElementsByClassName('post');

        if (!postsOnPage || postsOnPage.length <= lastNumPosts) {
            return;
        }

        for (var p = 0; p < postsOnPage.length; p++) {
            //skip invisible posts
            if (postsOnPage[p].style.display == 'none') {
                continue;
            }
            var found = pattern.exec(postsOnPage[p].innerHTML);
            if (!found) {
                continue;
            }
            for (var i = 0; i < found.length; i += 3) {
                new BNextPostWidget(postsOnPage[p], found[1]);
            }
        }

        setTimeout(replacePostsOnPageLoop, 1500);
    };

    if (jQuery && bungieNetPlatform) {
        setTimeout(replacePostsOnPageLoop, 1000);
    }
};

//add logic to window. Injecting the script inline grants it
//access to all objects on the window, including BNet page scripts.
var script = document.createElement('script');
script.type = "text/javascript";
script.textContent = '(' + init.toString() + ')();';
document.body.appendChild(script);

//bootstrap. This is dev/debug code intended to be replaced with
//a better solution. Perhaps event overriding on the bnet page.
script = document.createElement('script');
script.type = "text/javascript";
script.textContent = '(' + bootstrap.toString() + ')();';
document.body.appendChild(script);

