
//   var glsl = glsl => glsl
// // new THREE.ArrowHelper(dir,origin,length,hex) -->

//   // gl.createBuffer()
//   // //绑定一个数据源到绑定点 绑定点就是ARRAY_BUFFER
//   // gl.bindBuffer(gl.ARRAY_BUFFER,this.position_location)
//   // //通过绑定点向缓冲中存放数据
//   gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
//     ...this.vertices // [x1,y1,z1, x2,y2,z2]
//   ]), gl.STATIC_DRAW)

//   // ...
//   gl.drawArrays(gl.LINE_STRIP, 0, 2)

//   glsl`
//     void main(){
//       gl_Position = projection_matrix*(quaternions_matrix*mov_matrix)*a_position;
//     }

//   `
//     // //通过绑定点向缓冲中存放数据 Cone
//   gl.bufferData(gl.ARRAY_BUFER, new Float32Array([
//     ...this.vertices // [x1,y1,z1, x2,y2,z2, .........]
//   ]))
//   gl.uniformMatrix4fv(this.quaternions_matrix_location, new Float32Array([...this.quaternions_matrix]), false)

//   // 计算得到旋转四元数的矩阵前得知道，得知道如何用四元数来旋转一个三维的点。
//   // 什么是四元数
//   // 是有虚数和实数部分组成的复数，而且他是拥有多个虚数部分的超复数
//   // q = a +i+j+k

var glsl = glsl => glsl
var [s, c, rand, PI] = [Math.cos, Math.sin, Math.random, Math.PI]

var createFragmentShader = (gl, source) => {
  var shader = gl.createShader(gl.FRAGMENT_SHADER)
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  var success = gl.getShaderParameter(shader, gl.COMPILE_STATUS)
  if (success) {
    return shader
  }
  console.log(gl.getShaderInfoLog(shader))
  gl.deleteShader(shader)
}
var createVertexShader = (gl, source) => {
  var shader = gl.createShader(gl.VERTEX_SHADER)
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  var success = gl.getShaderParameter(shader, gl.COMPILE_STATUS)
  if (success) {
    return shader
  }
  console.log(gl.getShaderInfoLog(shader))
  gl.deleteShader(shader)
}

var createProgram = (gl, vertexShader, fragmentShader) => {
  var program = gl.createProgram()
  gl.attachShader(program, vertexShader)
  gl.attachShader(program, fragmentShader)
  gl.linkProgram(program)
  var success = gl.getProgramParameter(program, gl.LINK_STATUS)
  if (success) {
    return program
  }
  console.log(gl.getProgramInfoLog(program))
  gl.deleteProgram(program)
}

var Line = ([p0, p1], co) => {
 // console.log(co)
  var that = {
    render (projection_matrix){
      // console.log(projection_matrix)
      // return
      var {gl} = this
      if (!this.program){
        let vertexShader = createVertexShader(gl, glsl`
          attribute vec4 a_position;
          uniform mat4 u_mov_matrix;
          uniform mat4 u_projection_matrix;
          void main(){
            gl_Position = u_projection_matrix*u_mov_matrix*a_position;
          }
        
        `)
        let fragmentShader = createFragmentShader(gl, glsl`
          precision mediump float;
          uniform vec4 u_co;
          void main(){
            gl_FragColor = vec4(u_co.rgba);
          }
        `)

        this.program = createProgram(this.gl, vertexShader, fragmentShader)

        this.po_location = gl.getAttribLocation(this.program, 'a_position')
        this.mov_location = gl.getUniformLocation(this.program, 'u_mov_matrix')
        this.pro_location = gl.getUniformLocation(this.program, 'u_projection_matrix')
        this.co_location = gl.getUniformLocation(this.program, 'u_co')

        this.po_buffer = gl.createBuffer()
        gl.bindBuffer(gl.ARRAY_BUFFER, this.po_buffer)
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([...p0, ...p1]), gl.STATIC_DRAW)
      }
      gl.useProgram(this.program)

      gl.enableVertexAttribArray(this.po_location)
      gl.bindBuffer(gl.ARRAY_BUFFER, this.po_buffer)
      gl.vertexAttribPointer(this.po_location, 3, gl.FLOAT, false, 0, 0)

      gl.uniform4fv(this.co_location, co)

      gl.uniformMatrix4fv(this.pro_location, false, new Float32Array([...projection_matrix]))
      gl.uniformMatrix4fv(this.mov_location, false, new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        this.position[0], this.position[1], this.position[2], 1]
      ))
      gl.lineWidth(1)
      gl.drawArrays(gl.LINE_STRIP, 0, 2)

      // debugger
    },
    mov_location: null,
    pro_location: null,
    po_location: null,
    position: [0, 0, 0]
  }
  ;(function (){

  }).call(that)
  return that
}



var $canvas = document.querySelector('#canvas')
$canvas.width = $canvas.height = 600
var gl = $canvas.getContext('webgl')
var actors = []
var line = Line([[0, 0, 0], [.5, .5, 0]], [0, 0, 1, 1])
actors.push(line)
line.gl = gl
line.position = [0, 0, 0]

var floors = Array.from({length: 300}, (v, i) => {
  var line

  if (i > 150){
    line = Line([[0, 0, 0], [0, 0, 2]], [1, 1, 1, 1])
  } else {
    line = Line([[0, 0, 0], [rand() > .5 ? 2 : -2, 0, 0]], [1, 1, 1, 1])
  }

  actors.push(line)
  line.position = [2 - rand() * 4, -.5, 2 - rand() * 4]
  line.gl = gl

  return line
})

requestAnimationFrame(function animate (){
  requestAnimationFrame(animate)

  gl.viewport(0, 0, $canvas.width, $canvas.height)
  gl.clearColor(0, 0, 0, 1)
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
  gl.enable(gl.DEPTH_TEST)

  actors.forEach(o => o.render([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 1,
    0, 0, 0, 1
  ]))
})
