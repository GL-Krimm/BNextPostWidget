// ==UserScript==
// @name           Embedded Post Widget
// @description    Adds BBCode support for [post] for Bungie.net forum posts
// @include        http://www.bungie.net/*
// @version        0.2
// ==/UserScript==

(function() {
    
    var profileUrlRoot = 'http://www.bungie.net/en/view/profile/index#!page=index&mid={0}';
    var postUrlRoot = 'http://www.bungie.net/en/Forum/Post?id={0}';
    var jsonpUrlRoot = 'http://www.bungie.net/Platform/Forum/GetPostAndParent/{0}/';
    var lastProcessedNode, lastNumPosts;

    var pattern = /\[post id='(\d+)'\s?\](.+)\[\/post]/i;

    BBCodePostFormatter = function () {

    };

    // sets up the empty divs into which the posts will be read into
    BBCodePostFormatter.prototype.doInitialTagReplacement = function () {

        var oPost = document.getElementsByClassName('post');
        if (oPost) {
            oPost = oPost[0].getElementsByClassName('post_body')[0];
            replaceBbtagOnElement(oPost);
        }

        var postsOnPage = document.getElementsByClassName('replies');
        if (postsOnPage.length < 1) {
            return;
        }
        postsOnPage = postsOnPage[0];

        for (var reply = postsOnPage.firstChild; reply != null; reply = reply.nextSibling) {
            if (reply && reply.innerHTML) {
                lastProcessedNode = reply;
                replaceBbtagOnElement(reply);
            }
        }
    };

    BBCodePostFormatter.prototype.doSubsequenTagReplacement = function () {

        var postsOnPage = document.getElementsByClassName('replies')[0].childNodes;

        if (postsOnPage.length == lastNumPosts) {
            return;
        }
        lastNumPosts = postsOnPage.length;
        while ((lastProcessedNode = lastProcessedNode.nextSibling) != null) {
            replaceBbtagOnElement(lastProcessedNode);
        }
        setTimeout(this.doSubsequenTagReplacement, 1500);
    };

    var replaceBbtagOnElement = function (postNode) {
        var htmlStr = lastProcessedNode = postNode.innerHTML.toString();
        var found;
            
        found = pattern.exec(postNode.textContent);
        if (!found) {
            return;
        }
        var postIds = [];
        for (var i = 0; i < found.length; i += 3) {
            postIds.push(found[i + 1]);

            var newTag = "<a id='embedded-post-link-$' class='remote-post' href='javascript:void(0)' data-embedded-post-id='$'>".replace(/\$/g, found[i + 1]);
            newTag += found[i + 2];
            newTag += "</a>";
            newTag += "<p style='display:none' id='embedded-post-$'></p>".replace('\$', found[i + 1]);

            htmlStr = htmlStr.replace(pattern, newTag);              
        }
            
        postNode.innerHTML = htmlStr;

        for (var id in postIds) {
            var postLink = document.getElementById('embedded-post-link-' + postIds[id]);
            if (postLink) {
                bind(postLink, 'click', getAndAppendPost);
            }
        }
    };

    var getAndAppendPost = function (e) {
        
        var target = (e.originalTarget) ? e.originalTarget : e.srcElement;

        var postId = target.getAttribute('data-embedded-post-id');
        if (postId) {
            ajax({
                url: jsonpUrlRoot.replace('\{0\}', postId),
                onComplete: renderJsonResponse
            });
        }
    };

    var ajax = function (options) {

        var xhr = new XMLHttpRequest();

        xhr.onreadystatechange = function () {
            if (xhr.readyState < 4 || xhr.status !== 200) {
                if (options.onError) {
                    options.onError();
                }
                return;
            } else if (xhr.readyState === 4) {
                if (options.onComplete) {
                    options.onComplete(xhr);
                }
            }
        };

        xhr.open(options.method || "GET", options.url, true);
        xhr.send("");
    };

    //Renders the fechted post into the corresponding [post] BBTag
    var renderJsonResponse = function (json) {
        console.log('in callback');
        json = JSON.parse(json.responseText);

        var profile = json.Response.authors[0];
        var post = json.Response.results[0];
       
        var postLink = document.getElementById('embedded-post-link-' + post.postId);
        
        var embeddedPostCont = document.getElementById('embedded-post-' + post.postId);
        embeddedPostCont.style.display = 'block';

        if (embeddedPostCont) {
            var postWrapper = embeddedPostCont.appendChild(document.createElement('blockquote'));
            postWrapper.appendChild(getAvatarLinkNode(profile));

            var contentDiv = postWrapper.appendChild(document.createElement('div'));
            contentDiv.className = 'content';           
            contentDiv.appendChild(getProfileLinkNode(profile));
            contentDiv.appendChild(getPostTimeStampNode(post));
            contentDiv.appendChild(document.createElement('br'));          
            contentDiv.appendChild(getPostLinkNode(post));
            contentDiv.appendChild(document.createElement('br'));
            contentDiv.appendChild(document.createElement('br'));
            contentDiv = postWrapper.appendChild(document.createElement('div'));

            // Generally try to avoid using the innerHTML property like this, but the post
            // body returned is HTML encoded, and this is the most direct way to handle
            // rendering the post body in a human readable format.       

            //TODO: This is a great place to handle BBCode interpolation for the post body,
            //before it's appended to the page.
            contentDiv.innerHTML = post.body;

            contentDiv.appendChild(document.createElement('br'));
            contentDiv.appendChild(getPostLinkNode(post));
            
            var closeLink = contentDiv.appendChild(document.createElement('a'));
            closeLink.style.cssFloat = 'right';
            closeLink.href = 'javascript:(0)';
            closeLink.textContent = 'Close';

            bind(closeLink, 'click', function () {
                toggleDisplayPost(embeddedPostCont, postLink);
            });

            postLink.style.display = 'none';
            unbind(postLink, 'click', getAndAppendPost);
            bind(postLink, 'click', function () {
                toggleDisplayPost(embeddedPostCont, postLink);
            });
        }
    };

    var toggleDisplayPost = function (contentDiv, postLink) {
        if (contentDiv.style.display === 'none') {
            postLink.style.display = 'none';
            contentDiv.style.display = 'block';
        } else {
            postLink.style.display = 'block';
            contentDiv.style.display = 'none';
        }
    };

    //Provides a link element that takes the user to
    //the original post in its home thread.
    var getPostLinkNode = function (post) {
        var postLink = document.createElement('a');
        postLink.href = postUrlRoot.replace('\{0\}', post.postId);
        postLink.textContent = 'Original Post';

        return postLink;
    };

    //Provides a profile link element containing the user's name
    var getProfileLinkNode = function (profile) {
        var profLink = document.createElement('h1');
        profLink = profLink.appendChild(document.createElement('a'));
        profLink.textContent = profile.displayName;
        profLink.href = profileUrlRoot.replace('\{0\}', profile.membershipId);

        return profLink.parentNode;
    };

    //Provides an avatar image link element for the user in question
    var getAvatarLinkNode = function (profile) {
        var avatarLink = document.createElement('a');
        avatarLink.className = 'avatar';
        avatarLink.href = profileUrlRoot.replace('\{0\}', profile.membershipId);
        avatarLink = avatarLink.appendChild(document.createElement('img'));
        avatarLink.setAttribute('data-membership-id', profile.membershipId);
        avatarLink.src = profile.profilePicturePath;

        return avatarLink.parentNode;
    };

    var months = new Array("Jan", "Feb", "Mar",
        "Apr", "May", "Jun", "Jul", "Aug", "Sep",
        "Oct", "Nov", "Dec");

    //Provides the correctly formatted time stamp
    //for the provided post using the EN locale only ( for now? )
    //Decided on a home rolled approach rather than creating a dependency
    //on another library
    var getPostTimeStampNode = function (post) {
        //create the parent element
        var timeStampSpan = document.createElement('span');
        timeStampSpan.style.cssFloat = 'right';

        //begin processing the date information
        var createdAt = Date.parse(post.creationDate);
        var editedAt = Date.parse(post.lastModified);

        if (editedAt > createdAt) {
            timeStamp.textContent = 'Edited: ';
            timeStamp.className = 'editedTime';
        }
        
        //Re-assing editedAt to be a fully fledged date object. The initial
        //state of this member is equal to the creationDate, so using it
        //works equally for created at and edited at timestamp elements
        editedAt = new Date(editedAt);

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
    };

    // binds an event handler to the provided element, allowing for secondary
    // selectors to apply said event handler to child elements matching the selector
    var bind = function (element, type, handler, selector) {
        var finalHandler = null;

        if (selector) {
            finalHandler = function (e) {
                var target = (e.originalTarget) ? e.originalTarget : e.srcElement;

                if (selector.indexOf('.') == 0) {
                    if (target.className.indexOf(selector.substring(1)) >= 0) {
                        handler(e);
                    }
                } else {
                    if (target.tagName && target.tagName === selector.toUpperCase()) {
                        handler(e);
                    }
                }                
            };
        }

        if (element.addEventListener) {
            element.addEventListener(type, finalHandler || handler, false);
        } else {
            element.attachEvent('on' + type, finalHandler || handler);
        }
    };

    // unbinds the specified event handler from the provided node.
    var unbind = function (element, type, handler) {
        if (element.removeEventListener) {
            element.removeEventListener(type, handler);
        }
    };

    // throw away logic used to test the functionality on page.
    setTimeout(function () {
        var b = new BBCodePostFormatter();
        b.doInitialTagReplacement();

        setTimeout(b.doSubsequenTagReplacement, 1500);

    }, 2500);

})();