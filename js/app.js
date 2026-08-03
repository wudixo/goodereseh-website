const params = new URLSearchParams(window.location.search);

const artwork = params.get("artwork");

if (artwork) {

    document.getElementById("artwork").value = artwork;

}