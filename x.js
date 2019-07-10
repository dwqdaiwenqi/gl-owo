
var [Scene, WebGLRenderer, PerspectiveCamera, AmbientLight, BoxGeometry, PlaneGeometry, MeshBasicMaterial, Mesh] = [3]

var createShader = (gl, type, source) => {
  var shader = gl.createShader(type)
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

Scene = class {
  constructor (){
    this.children = []
    this.position = {x: 0, y: 0, z: 0}
    this.scale = {x: 1, y: 1, z: 1}
    this.rotation = {x: 0, y: 0, z: 0}
    this.local_matrix = m4.identity()
    this.world_matrix = m4.identity()
  }
  udpateWorldMatrix (){
    var {position: t, rotation: r, scale: s} = this

     t = [t.x, t.y, t.z]
     r = [r.x, r.y, r.z]
     s = [s.x, s.y, s.z]

     var dst = m4.identity()
     m4.translation(t[0], t[1], t[2], dst)
     m4.xRotate(dst, r[0], dst)
     m4.yRotate(dst, r[1], dst)
     m4.zRotate(dst, r[2], dst)
     m4.scale(dst, s[0], s[1], s[2], dst)

     this.local_matrix = dst

    m4.copy(this.local_matrix, this.world_matrix)

    this.children.forEach(child => {
      child.udpateWorldMatrix(this.world_matrix)
    })
  }
  update (){
    this.udpateWorldMatrix()
  }
  add (o){
    o.setParent(this)
  }
}
PerspectiveCamera = class {
  constructor (fov = 45, aspect = 1, near = 1, far = 2000){
    this.position = {x: 0, y: 0, z: 0}
    this.rotation = {x: 0, y: 0, z: 0}
    this.target = {}

    this.lookAt({x: 0, y: 0, z: 1})

    this.fov = fov
    this.aspect = aspect
    this.near = near
    this.far = far
  }
  update (){
    var {fov, aspect, near, far} = this
    var projectionMatrix = m4.perspective(fov, aspect, near, far)

    // Compute the camera's matrix using look at.

    var up = [0, 1, 0]
    var cameraMatrix = m4.lookAt(
      [this.position.x, this.position.y, this.position.z],
      [this.target.x, this.target.y, this.target.z],
       up
    )

    // Make a view matrix from the camera matrix.
    var viewMatrix = m4.inverse(cameraMatrix)

    var viewProjectionMatrix = m4.multiply(projectionMatrix, viewMatrix)

    // console.log(cameraMatrix, viewMatrix, projectionMatrix, viewProjectionMatrix)
    // console.log('12222222222222')

    this.matrix = viewProjectionMatrix
  }
  lookAt (vec3){
    this.target = vec3
  }
}

WebGLRenderer = class {
  constructor ({antialias = false, preserveDrawingBuffer = false} = {}){
    this.domElement = document.createElement('canvas')
    this.gl = this.domElement.getContext('webgl', {antialias, preserveDrawingBuffer})
  }
  setSize (width, height){
    this.domElement.width = width
    this.domElement.height = height
  }
  render (scene, camera){
    // Tell WebGL how to convert from clip space to pixels
    this.gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height)

    // Clear the canvas AND the depth buffer.
    this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT)

    // Enable the depth buffer
    this.gl.enable(this.gl.DEPTH_TEST)
    // debugger
    camera.update()

    scene.update()

    scene.children.forEach(o => {
      if (!o.gl) o.gl = this.gl
      o.update(camera.matrix)
    })
  }
}

Mesh = class {
  constructor (geometry, material){
    this.geometry = geometry
    this.material = material

    this.position = {x: 0, y: 0, z: 0}
    this.scale = {x: 1, y: 1, z: 1}
    this.rotation = {x: 0, y: 0, z: 0}

    this.world_matrix = m4.identity()
    this.local_matrix = m4.identity()
    this.children = []

    this.parent
    this.gl
    this.program
    this.position_location
    this.u_matrix_location
    this.u_color_location
    this.position_buffer
  }
  update (view_projection_materix){
    /// //////

    // m4.multiply(parentWorldMatrix, this.localMatrix, this.worldMatrix)

    /// /////

    var {gl} = this

    var vertexShader = createShader(gl, gl.VERTEX_SHADER, `
      attribute vec4 a_position;
    
      uniform mat4 u_matrix;
      void main() {
        gl_Position = u_matrix*a_position;
      } 
    `)
    var fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, `
      precision mediump float;
    
      // Passed in from the vertex shader.
      uniform vec4 u_color;
      
      void main() {
        gl_FragColor = vec4(u_color.rgba);
      }
    `)
    var program = createProgram(this.gl, vertexShader, fragmentShader)
    this.program = program

    this.position_location = gl.getAttribLocation(this.program, 'a_position')
    this.u_matrix_location = gl.getUniformLocation(this.program, 'u_matrix')
    this.u_color_location = gl.getUniformLocation(this.program, 'u_color')

    var {width, height, buffer_info} = this.geometry
    this.position_buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, this.position_buffer)
    // Put geometry data into buffer
    gl.bufferData(gl.ARRAY_BUFFER, buffer_info, gl.STATIC_DRAW)

     // Tell it to use our program (pair of shaders)
     gl.useProgram(this.program)
     // Turn on the position attribute
     gl.enableVertexAttribArray(this.position_location)

     gl.bindBuffer(gl.ARRAY_BUFFER, this.position_buffer)
     // Tell the position attribute how to get data out of positionBuffer (ARRAY_BUFFER)
     gl.vertexAttribPointer(this.position_location, 3, gl.FLOAT, false, 0, 0)

     var matrix = m4.multiply(view_projection_materix, this.world_matrix)

     gl.uniformMatrix4fv(this.u_matrix_location, false, matrix)

     gl.uniform4fv(this.u_color_location, this.material.color)

     gl.drawArrays(gl.TRIANGLE_FAN, 0, 4)
  }
  udpateWorldMatrix (parent_matrix){
    var {position: t, rotation: r, scale: s} = this

    t = [t.x, t.y, t.z]
    r = [r.x, r.y, r.z]
    s = [s.x, s.y, s.z]

    var dst = m4.identity()
    m4.translation(t[0], t[1], t[2], dst)
    m4.xRotate(dst, r[0], dst)
    m4.yRotate(dst, r[1], dst)
    m4.zRotate(dst, r[2], dst)
    m4.scale(dst, s[0], s[1], s[2], dst)

   // console.log(dst)
    this.local_matrix = dst

    if (parent_matrix) {
      m4.multiply(parent_matrix, this.local_matrix, this.world_matrix)
    } else {
      m4.copy(this.local_matrix, this.world_matrix)
    }

    this.children.forEach(child => {
      child.udpateWorldMatrix(this.world_matrix)
    })
  }
  setParent (parent){
    // 从父节点中移除
    if (this.parent) {
      var ndx = this.parent.children.indexOf(this)
      if (ndx >= 0) {
        this.parent.children.splice(ndx, 1)
      }
    }

    // 添加到新的父节点上
    if (parent) {
      parent.children.push(this)
    }
    this.parent = parent
  }
}
MeshBasicMaterial = class {
  constructor ({color = [0, 0, 0, 0]} = {}){
    this.color = color
  }
}
PlaneGeometry = class {
  constructor (width, height){
    this.width = width
    this.height = height

    this.buffer_info = new Float32Array([
      0, 0, 0,
      width, 0, 0,
      width, height, 0,
      0, height, 0
    ])

    var matrix = m4.translation(-this.width * .5, -this.height * .5, 0)

    for (let i = 0, len = this.buffer_info.length; i < len; i += 3){
      let po = this.buffer_info

      let vector = m4.vectorMultiply([po[i + 0], po[i + 1], po[i + 2], 1], matrix)
      po[i + 0] = vector[0]
      po[i + 1] = vector[1]
      po[i + 2] = vector[2]
    }
  }
  update (){

  }
}

export default {
  Scene,
  WebGLRenderer,
  PerspectiveCamera,
  AmbientLight,
  PlaneGeometry,
  MeshBasicMaterial,
  Mesh
}
