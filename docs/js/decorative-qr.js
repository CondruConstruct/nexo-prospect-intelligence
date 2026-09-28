
/* ---------- Decorative QR pattern (illustration only, not a real code) ---------- */
function rng(seed){return function(){seed|=0;seed=seed+0x6D2B79F5|0;var t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function drawQR(svg,seed){
  var n=25,r=rng(seed),out=[];
  function finder(x,y){
    out.push('<rect x="'+x+'" y="'+y+'" width="7" height="7" fill="currentColor"/>');
    out.push('<rect x="'+(x+1)+'" y="'+(y+1)+'" width="5" height="5" fill="#fff"/>');
    out.push('<rect x="'+(x+2)+'" y="'+(y+2)+'" width="3" height="3" fill="currentColor"/>');
  }
  function inFinder(i,j){return (i<8&&j<8)||(i>=n-8&&j<8)||(i<8&&j>=n-8)}
  out.push('<rect width="'+n+'" height="'+n+'" fill="#fff"/>');
  for(var j=0;j<n;j++)for(var i=0;i<n;i++){
    if(inFinder(i,j))continue;
    if(r()>.52)out.push('<rect x="'+i+'" y="'+j+'" width="1.02" height="1.02" fill="currentColor"/>');
  }
  finder(0,0);finder(n-7,0);finder(0,n-7);
  svg.setAttribute('viewBox','-1 -1 '+(n+2)+' '+(n+2));
  svg.setAttribute('shape-rendering','crispEdges');
  svg.innerHTML=out.join('');
}
document.querySelectorAll('.qr-js').forEach(function(s){drawQR(s,+s.dataset.seed||1)});
