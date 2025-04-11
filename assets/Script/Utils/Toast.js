//一个简单的tost组件，用法：
// let Toast = reqire('Toast.js')
// Toast(text,{gravity,duration,bg_color})
//text:要显示的字符串
//gravity(可选):位置，String类型，可选值('CENTER','TOP','BOTTOM'),默认为'CENTER'
//duration(可选):时间，Number类型，单位为秒，默认1s
//bg_color(可选):颜色，cc.color类型，默认cc.color(102, 102, 102, 200)
// 全局變數來追蹤當前活動的 Toast
let activeToast = null;

function Toast(
  text = "",
  {
    gravity = "CENTER",
    duration = 1,
    bg_color = cc.color(102, 102, 102, 200),
    text_color = cc.color(255, 255, 255)
  } = {}
) {
  // 如果有活動中的 Toast，先將其移除
  if (activeToast) {
    activeToast.destroy();
    activeToast = null;
  }
  
  // canvas
  let canvas = cc.director.getScene().getComponentInChildren(cc.Canvas);
  let width = canvas.node.width;
  let height = canvas.node.height;

  let bgNode = new cc.Node();

  // Lable文本格式設置
  let textNode = new cc.Node();
  let textLabel = textNode.addComponent(cc.Label);
  textLabel.horizontalAlign = cc.Label.HorizontalAlign.CENTER;
  textLabel.verticalAlign = cc.Label.VerticalAlign.CENTER;
  textLabel.fontSize = 30;
  textLabel.string = text;
  textLabel.node.color = text_color;

  // 當文本寬度過長時，設置為自動換行格式
  if (text.length * textLabel.fontSize > (width * 3) / 5) {
    textNode.width = (width * 3) / 5;
    textLabel.overflow = cc.Label.Overflow.RESIZE_HEIGHT;
  } else {
    textNode.width = text.length * textLabel.fontSize;
  }
  let lineCount =
    ~~((text.length * textLabel.fontSize) / ((width * 3) / 5)) + 1;
  textNode.height = textLabel.fontSize * lineCount;

  // 背景設置
  let ctx = bgNode.addComponent(cc.Graphics);
  ctx.arc(
    -textNode.width / 2,
    0,
    textNode.height / 2 + 20,
    0.5 * Math.PI,
    1.5 * Math.PI,
    true
  );
  ctx.lineTo(textNode.width / 2, -(textNode.height / 2 + 20));
  ctx.arc(
    textNode.width / 2,
    0,
    textNode.height / 2 + 20,
    1.5 * Math.PI,
    0.5 * Math.PI,
    true
  );
  ctx.lineTo(-textNode.width / 2, textNode.height / 2 + 20);
  ctx.fillColor = bg_color;
  ctx.fill();

  bgNode.addChild(textNode);

  // gravity 設置Toast顯示的位置
  if (gravity === "CENTER") {
    bgNode.y = 0;
    bgNode.x = 0;
  } else if (gravity === "TOP") {
    bgNode.y = bgNode.y + (height / 5) * 2;
  } else if (gravity === "BOTTOM") {
    bgNode.y = bgNode.y - (height / 5) * 2;
  }

  canvas.node.addChild(bgNode);
  
  // 設置當前活動的 Toast
  activeToast = bgNode;

  let finished = cc.callFunc(function() {
    // 如果被銷毀的是當前活動的 Toast，則清除引用
    if (activeToast === bgNode) {
      activeToast = null;
    }
    bgNode.destroy();
  });
  
  let action = cc.sequence(
    cc.moveBy(duration, cc.v2(0, 0)),
    cc.fadeOut(0.3),
    finished
  );
  
  bgNode.runAction(action);
  
  // 返回 bgNode，使外部可以手動控制 Toast
  return bgNode;
}

module.exports = Toast;