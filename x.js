
var [Scene, WebGLRenderer, PerspectiveCamera, AmbientLight, PlaneGeometry, MeshBasicMaterial, Mesh] = [3]

var TorusGeometry, BoxGeometry, LatheGeometry, CylinderGeometry

var hsva = (h, s, v, a) => {
  if (s > 1 || v > 1 || a > 1){ return }
  var th = h % 360
  var i = Math.floor(th / 60)
  var f = th / 60 - i
  var m = v * (1 - s)
  var n = v * (1 - s * f)
  var k = v * (1 - s * (1 - f))
  var color = new Array()
  if (!s > 0 && !s < 0){
      color.push(v, v, v, a)
  } else {
      var r = new Array(v, n, m, m, k, v)
      var g = new Array(k, v, v, n, m, m)
      var b = new Array(m, m, k, v, v, n)
      color.push(r[i], g[i], b[i], a)
  }
  return color
}

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

    if (!this.program){
      let vertexShader = createShader(gl, gl.VERTEX_SHADER, `
        attribute vec4 a_position;
        uniform mat4 u_matrix;
        void main() {
          gl_Position = u_matrix*a_position;
        } 
      `)
      let fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, `
        precision mediump float;
      
        // Passed in from the vertex shader.
        uniform vec4 u_color;
        
        void main() {
          gl_FragColor = vec4(u_color.rgba);
        }
      `)
      let program = createProgram(this.gl, vertexShader, fragmentShader)
      this.program = program
    }

    this.position_location = gl.getAttribLocation(this.program, 'a_position')
    this.u_matrix_location = gl.getUniformLocation(this.program, 'u_matrix')
    this.u_color_location = gl.getUniformLocation(this.program, 'u_color')

    var {buffer_info, idx} = this.geometry
    this.position_buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, this.position_buffer)
    // Put geometry data into buffer
    gl.bufferData(gl.ARRAY_BUFFER, buffer_info, gl.STATIC_DRAW)

      /// //////////////////////////
      // IBOの生成

      this.idx_buffer = gl.createBuffer()
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.idx_buffer)
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW)

      /// //////////////////////

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

     // gl.drawArrays(gl.TRIANGLE_FAN, 0, 4)

     // gl.drawElements(gl.TRIANGLES, idx.length, gl.UNSIGNED_SHORT, 0)

     gl.drawElements(gl.LINE_STRIP, idx.length, gl.UNSIGNED_SHORT, 0)

    //  console.log(this.children)
     {
      this.children.forEach(o => {
        if (!o.gl) o.gl = this.gl
        o.update(view_projection_materix)
      })
     }
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
  add (o){
    o.setParent(this)
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

    this.vertices = []
    this.faces = []
    // 頂点属性を格納する配列
    var position = [
      0, 0, 0,
      width, 0, 0,
      width, height, 0,
      0, height, 0
    ]
    // 頂点のインデックスを格納する配列
    var index = [
      0, 1, 2,
      2, 3, 0
    ]

    this.buffer_info = new Float32Array([
      0, 0, 0,
      width, 0, 0,
      width, height, 0,
      0, height, 0
    ])

    this.idx = new Int16Array([
      0, 1, 2,
      2, 3, 0
    ])

    for (let i = 0, len = this.idx.length; i < len; i += 3){
      let ii = i
      let face_idx = {
        a: this.idx[ii], b: this.idx[ii + 1], c: this.idx[ii + 2]
      }
      let a = {
        x: this.buffer_info[face_idx.a * 3],
        y: this.buffer_info[face_idx.a * 3 + 1],
        z: this.buffer_info[face_idx.a * 3 + 2]
      }
      let b = {
        x: this.buffer_info[face_idx.b * 3],
        y: this.buffer_info[face_idx.b * 3 + 1],
        z: this.buffer_info[face_idx.b * 3 + 2]
      }
      let c = {
        x: this.buffer_info[face_idx.c * 3],
        y: this.buffer_info[face_idx.c * 3 + 1],
        z: this.buffer_info[face_idx.c * 3 + 2]
      }

      this.faces.push({a, b, c})
    }

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

BoxGeometry = class {
  constructor (side = 10){
    this.vertices = []
    this.faces = []
    var hs = side * 0.5
    var pos = [
      -hs, -hs, hs, hs, -hs, hs, hs, hs, hs, -hs, hs, hs,
      -hs, -hs, -hs, -hs, hs, -hs, hs, hs, -hs, hs, -hs, -hs,
      -hs, hs, -hs, -hs, hs, hs, hs, hs, hs, hs, hs, -hs,
      -hs, -hs, -hs, hs, -hs, -hs, hs, -hs, hs, -hs, -hs, hs,
       hs, -hs, -hs, hs, hs, -hs, hs, hs, hs, hs, -hs, hs,
      -hs, -hs, -hs, -hs, -hs, hs, -hs, hs, hs, -hs, hs, -hs
    ]
    var nor = [
      -1.0, -1.0, 1.0, 1.0, -1.0, 1.0, 1.0, 1.0, 1.0, -1.0, 1.0, 1.0,
      -1.0, -1.0, -1.0, -1.0, 1.0, -1.0, 1.0, 1.0, -1.0, 1.0, -1.0, -1.0,
      -1.0, 1.0, -1.0, -1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, -1.0,
      -1.0, -1.0, -1.0, 1.0, -1.0, -1.0, 1.0, -1.0, 1.0, -1.0, -1.0, 1.0,
       1.0, -1.0, -1.0, 1.0, 1.0, -1.0, 1.0, 1.0, 1.0, 1.0, -1.0, 1.0,
      -1.0, -1.0, -1.0, -1.0, -1.0, 1.0, -1.0, 1.0, 1.0, -1.0, 1.0, -1.0
    ]

    var idx = [
       0, 1, 2, 0, 2, 3,
       4, 5, 6, 4, 6, 7,
       8, 9, 10, 8, 10, 11,
      12, 13, 14, 12, 14, 15,
      16, 17, 18, 16, 18, 19,
      20, 21, 22, 20, 22, 23
    ]

    this.buffer_info = new Float32Array([
      ...pos
    ])

    this.idx = new Int16Array([
      ...idx
    ])

    {
      for (let i = 0, len = pos.length; i < len; i += 3){
        this.vertices.push({x: pos[i], y: pos[i + 1], z: pos[i + 2]})
      }
    }

    for (let i = 0, len = idx.length; i < len; i += 3){
      // 这个面的三个顶点索引a b c
      let [a, b, c] = [
        idx[i], idx[i + 1], idx[i + 2]
      ]
      let face = {
        a,
        b,
        c,
        normal: {},
        vertexNormals: [
          // 每个顶点索引所对应的法线xyz
          {x: nor[a * 3], y: nor[a * 3 + 1], z: nor[a * 3 + 2]},
          {x: nor[b * 3], y: nor[b * 3 + 1], z: nor[b * 3 + 2]},
          {x: nor[c * 3], y: nor[c * 3 + 1], z: nor[c * 3 + 2]}
        ]
      }
      this.faces.push(face)
    }
  }
}

// Derived from: http://jacksondunstan.com/articles/1924

CylinderGeometry = class {
  constructor (radius = 10, height = 10, sides = 20){
    var stepTheta = 2 * Math.PI / sides
    var verticesPerCap = 9 * sides

    var vertices = []
    var theta = 0
    var i = 0

    var r = radius
    // Top Cap
    for (; i < verticesPerCap; i += 9) {
      vertices[i ] = Math.cos(theta) * r
      vertices[i + 1] = height
      vertices[i + 2] = Math.sin(theta) * r
      theta += stepTheta

      vertices[i + 3] = 0.0
      vertices[i + 4] = height
      vertices[i + 5] = 0.0

      vertices[i + 6] = Math.cos(theta) * r
      vertices[i + 7] = height
      vertices[i + 8] = Math.sin(theta) * r
    }

    // Bottom Cap
    theta = 0
    for (; i < verticesPerCap + verticesPerCap; i += 9) {
      vertices[i + 6] = Math.cos(theta) * r
      vertices[i + 7] = -height
      vertices[i + 8] = Math.sin(theta) * r
      theta += stepTheta

      vertices[i + 3] = 0.0
      vertices[i + 4] = -height
      vertices[i + 5] = 0.0

      vertices[i ] = Math.cos(theta) * r
      vertices[i + 1] = -height
      vertices[i + 2] = Math.sin(theta) * r
    }

    for (var j = 0; j < sides; ++j) {
      for (var k = 0; k < 3; ++k, ++i) {
        vertices[i] = vertices[0 + k + 9 * j]
      }
      for (var k = 0; k < 3; ++k, ++i) {
        vertices[i] = vertices[6 + k + 9 * j]
      }
      for (var k = 0; k < 3; ++k, ++i) {
        vertices[i] = vertices[verticesPerCap + k + 9 * j]
      }

      for (var k = 0; k < 3; ++k, ++i) {
        vertices[i] = vertices[0 + k + 9 * j]
      }
      for (var k = 0; k < 3; ++k, ++i) {
        vertices[i] = vertices[verticesPerCap + k + 9 * j]
      }
      for (var k = 0; k < 3; ++k, ++i) {
        vertices[i] = vertices[verticesPerCap + 6 + k + 9 * j]
      }
    }

    var indices = new Array(vertices.length / 3)
    for (i = 0; i < indices.length; ++i) indices[i] = i

    function sub (a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]] };
    function cross (a, b) {
      return [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0]
      ]
    };
    function normalize (a) {
      var length = a[0] * a[0] + a[1] * a[1] + a[2] * a[2]
      return [a[0] / length, a[1] / length, a[2] / length]
    };

    var normals = []

    for (var i = 0; i < vertices.length; i += 9) {
      var a = [vertices[i ], vertices[i + 1], vertices[i + 2]]
      var b = [vertices[i + 3], vertices[i + 4], vertices[i + 5]]
      var c = [vertices[i + 6], vertices[i + 7], vertices[i + 8]]
      var normal = normalize(cross(sub(a, b), sub(a, c)))
      normals = normals.concat(normal, normal, normal)
    }

    this.buffer_info = new Float32Array([
     ...vertices
    ])

    this.idx = new Int16Array([
      ...indices
    ])
    this.faces = []
    this.vertices = [...vertices]
  }
}

TorusGeometry = class {
  constructor (row = 10, column = 10, irad = 5, orad = 10){
    this.faces = []
    this.vertices = []

    var nor = []

    var pos = [], col = [], idx = []
		for (var i = 0; i <= row; i++){
			var r = Math.PI * 2 / row * i
			var rr = Math.cos(r)
			var ry = Math.sin(r)
			for (var ii = 0; ii <= column; ii++){
				var tr = Math.PI * 2 / column * ii
				var tx = (rr * irad + orad) * Math.cos(tr)
				var ty = ry * irad
				var tz = (rr * irad + orad) * Math.sin(tr)
				pos.push(tx, ty, tz)
				// var tc = hsva(360 / column * ii, 1, 1, 1)
        // col.push(tc[0], tc[1], tc[2], tc[3])

        var rx = rr * Math.cos(tr)
        var rz = rr * Math.sin(tr)
        nor.push(rx, ry, rz)

        this.vertices.push({x: tx, y: ty, z: tz})
			}
		}
		for (i = 0; i < row; i++){
			for (ii = 0; ii < column; ii++){
				r = (column + 1) * i + ii
				idx.push(r, r + column + 1, r + 1)
				idx.push(r + column + 1, r + column + 2, r + 1)
			}
    }

    this.buffer_info = new Float32Array([
      ...pos
    ])

    this.idx = new Int16Array([
      ...idx
    ])

    // for (let i = 0, len = this.idx.length; i < len; i += 3){
    //   let ii = i
    //   let face_idx = {
    //     a: this.idx[ii], b: this.idx[ii + 1], c: this.idx[ii + 2]
    //   }
    //   let a = {
    //     x: this.buffer_info[face_idx.a * 3],
    //     y: this.buffer_info[face_idx.a * 3 + 1],
    //     z: this.buffer_info[face_idx.a * 3 + 2]
    //   }
    //   let b = {
    //     x: this.buffer_info[face_idx.b * 3],
    //     y: this.buffer_info[face_idx.b * 3 + 1],
    //     z: this.buffer_info[face_idx.b * 3 + 2]
    //   }
    //   let c = {
    //     x: this.buffer_info[face_idx.c * 3],
    //     y: this.buffer_info[face_idx.c * 3 + 1],
    //     z: this.buffer_info[face_idx.c * 3 + 2]
    //   }

    //   this.faces.push({a, b, c})
    // }
    for (let i = 0, len = idx.length; i < len; i += 3){
      // 这个面的三个顶点索引a b c
      let [a, b, c] = [
        idx[i], idx[i + 1], idx[i + 2]
      ]
      let face = {
        a,
        b,
        c,
        normal: {},
        vertexNormals: [
          // 每个顶点索引所对应的法线xyz
          {x: nor[a * 3], y: nor[a * 3 + 1], z: nor[a * 3 + 2]},
          {x: nor[b * 3], y: nor[b * 3 + 1], z: nor[b * 3 + 2]},
          {x: nor[c * 3], y: nor[c * 3 + 1], z: nor[c * 3 + 2]}
        ]
      }
      this.faces.push(face)
    }
  }
}

LatheGeometry = class {
  constructor (points){
    this.points = points

    const v2 = (function () {
      // adds 1 or more v2s
      function add (a, ...args) {
        const n = a.slice();
        [...args].forEach(p => {
          n[0] += p[0]
          n[1] += p[1]
        })
        return n
      }

      function sub (a, ...args) {
        const n = a.slice();
        [...args].forEach(p => {
          n[0] -= p[0]
          n[1] -= p[1]
        })
        return n
      }

      function mult (a, s) {
        if (Array.isArray(s)) {
          let t = s
          s = a
          a = t
        }
        if (Array.isArray(s)) {
          return [
            a[0] * s[0],
            a[1] * s[1]
          ]
        } else {
          return [a[0] * s, a[1] * s]
        }
      }

      function lerp (a, b, t) {
        return [
          a[0] + (b[0] - a[0]) * t,
          a[1] + (b[1] - a[1]) * t
        ]
      }

      function min (a, b) {
        return [
          Math.min(a[0], b[0]),
          Math.min(a[1], b[1])
        ]
      }

      function max (a, b) {
        return [
          Math.max(a[0], b[0]),
          Math.max(a[1], b[1])
        ]
      }

      // compute the distance squared between a and b
      function distanceSq (a, b) {
        const dx = a[0] - b[0]
        const dy = a[1] - b[1]
        return dx * dx + dy * dy
      }

      // compute the distance between a and b
      function distance (a, b) {
        return Math.sqrt(distanceSq(a, b))
      }

      // compute the distance squared from p to the line segment
      // formed by v and w
      function distanceToSegmentSq (p, v, w) {
        const l2 = distanceSq(v, w)
        if (l2 === 0) {
          return distanceSq(p, v)
        }
        let t = ((p[0] - v[0]) * (w[0] - v[0]) + (p[1] - v[1]) * (w[1] - v[1])) / l2
        t = Math.max(0, Math.min(1, t))
        return distanceSq(p, lerp(v, w, t))
      }

      // compute the distance from p to the line segment
      // formed by v and w
      function distanceToSegment (p, v, w) {
        return Math.sqrt(distanceToSegmentSq(p, v, w))
      }

      return {
        add: add,
        sub: sub,
        max: max,
        min: min,
        mult: mult,
        lerp: lerp,
        distance: distance,
        distanceSq: distanceSq,
        distanceToSegment: distanceToSegment,
        distanceToSegmentSq: distanceToSegmentSq
      }
    }())

     // get the points from an SVG path. assumes a continous line
	 function parseSVGPath (svg) {
    const points = []
    let delta = false
    let keepNext = false
    let need = 0
    let value = ''
    let values = []
    let lastValues = [0, 0]
    let nextLastValues = [0, 0]

    function addValue () {
      if (value.length > 0) {
        values.push(parseFloat(value))
        if (values.length === 2) {
          if (delta) {
            values[0] += lastValues[0]
            values[1] += lastValues[1]
          }
          points.push(values)
          if (keepNext) {
            nextLastValues = values.slice()
          }
          --need
          if (!need) {
            lastValues = nextLastValues
          }
          values = []
        }
        value = ''
      }
    }

    svg.split('').forEach(c => {
      if ((c >= '0' && c <= '9') || 'c' === '.') {
        value += c
      } else if (c === '-') {
        addValue()
        value = '-'
      } else if (c === 'm') {
        addValue()
        keepNext = true
        need = 1
        delta = true
      } else if (c === 'c') {
        addValue()
        keepNext = true
        need = 3
        delta = true
      } else if (c === 'M') {
        addValue()
        keepNext = true
        need = 1
        delta = false
      } else if (c === 'C') {
        addValue()
        keepNext = true
        need = 3
        delta = false
      } else if (c === ',') {
        addValue()
      } else if (c === ' ') {
        addValue()
      }
    })
    addValue()
    let min = points[0].slice()
    let max = points[0].slice()
    for (let i = 1; i < points.length; ++i) {
      min = v2.min(min, points[i])
      max = v2.max(max, points[i])
    }
    let range = v2.sub(max, min)
    let halfRange = v2.mult(range, .5)
    for (let i = 0; i < points.length; ++i) {
      const p = points[i]
      p[0] = p[0] - min[0]
      p[1] = (p[1] - min[0]) - halfRange[1]
    }
    return points
  }

    function clamp (v, min, max) {
      return Math.max(Math.min(v, max), min)
    }

    function lerp (a, b, t) {
      return a + (b - a) * t
    }
    // gets points across all segments
    function getPointsOnBezierCurves (points, tolerance) {
      const newPoints = []
      const numSegments = (points.length - 1) / 3
      for (let i = 0; i < numSegments; ++i) {
        const offset = i * 3
        getPointsOnBezierCurveWithSplitting(points, offset, tolerance, newPoints)
      }
      return newPoints
    }
    function getPointsOnBezierCurveWithSplitting (points, offset, tolerance, newPoints) {
      const outPoints = newPoints || []
      if (flatness(points, offset) < tolerance) {
        // just add the end points of this curve
        outPoints.push(points[offset + 0])
        outPoints.push(points[offset + 3])
      } else {
        // subdivide
        const t = .5
        const p1 = points[offset + 0]
        const p2 = points[offset + 1]
        const p3 = points[offset + 2]
        const p4 = points[offset + 3]

        const q1 = v2.lerp(p1, p2, t)
        const q2 = v2.lerp(p2, p3, t)
        const q3 = v2.lerp(p3, p4, t)

        const r1 = v2.lerp(q1, q2, t)
        const r2 = v2.lerp(q2, q3, t)

        const red = v2.lerp(r1, r2, t)

        // do 1st half
        getPointsOnBezierCurveWithSplitting([p1, q1, r1, red], 0, tolerance, outPoints)
        // do 2nd half
        getPointsOnBezierCurveWithSplitting([red, r2, q3, p4], 0, tolerance, outPoints)
      }
      return outPoints
    }
    function flatness (points, offset) {
      const p1 = points[offset + 0]
      const p2 = points[offset + 1]
      const p3 = points[offset + 2]
      const p4 = points[offset + 3]

      let ux = 3 * p2[0] - 2 * p1[0] - p4[0]; ux *= ux
      let uy = 3 * p2[1] - 2 * p1[1] - p4[1]; uy *= uy
      let vx = 3 * p3[0] - 2 * p4[0] - p1[0]; vx *= vx
      let vy = 3 * p3[1] - 2 * p4[1] - p1[1]; vy *= vy

      if (ux < vx) {
        ux = vx
      }

      if (uy < vy) {
        uy = vy
      }

      return ux + uy
    }
     // rotates around Y axis.
     function lathePoints (points,
                         startAngle, // angle to start at (ie 0)
                         endAngle, // angle to end at (ie Math.PI * 2)
                         numDivisions, // how many quads to make around
                         capStart, // true to cap the top
                         capEnd) { // true to cap the bottom
      const positions = []
      const texcoords = []
      const indices = []

      const vOffset = capStart ? 1 : 0
      const pointsPerColumn = points.length + vOffset + (capEnd ? 1 : 0)
      const quadsDown = pointsPerColumn - 1

      // generate points
      for (let division = 0; division <= numDivisions; ++division) {
        const u = division / numDivisions
        const angle = lerp(startAngle, endAngle, u)
        const mat = m4.yRotation(angle)

        points.forEach((p, ndx) => {
          // const tp = m4.transformPoint(mat, [...p, 0])
          // positions.push(tp[0], tp[1], tp[2])

          let vector = m4.vectorMultiply([p[0], p[1], 0, 1], mat)

           positions.push(vector[0], vector[1], vector[2])
        })
      }

      // generate indices
      for (let division = 0; division < numDivisions; ++division) {
        const column1Offset = division * pointsPerColumn
        const column2Offset = column1Offset + pointsPerColumn
        for (let quad = 0; quad < quadsDown; ++quad) {
          indices.push(column1Offset + quad, column1Offset + quad + 1, column2Offset + quad)
          indices.push(column1Offset + quad + 1, column2Offset + quad + 1, column2Offset + quad)
        }
      }

      return {
        position: positions,
        texcoord: texcoords,
        indices: indices
      }
    }

      // const svg = 'm44,434c18,-33 19,-66 15,-111c-4,-45 -37,-104 -39,-132c-2,-28 11,-51 16,-81c5,-30 3,-63 -36,-63'
      // const curvePoints = parseSVGPath(svg)
      // const tempPoints = getPointsOnBezierCurves(curvePoints, 1)
      // const points_a = simplifyPoints(tempPoints, 0, tempPoints.length, 1)
      // const arrays = lathePoints(points_a, 0, Math.PI * 2, 10, false, false)

      const curvePoints = [ [0, 0], [10, 10], [10, 20], [0, 100] ]
      const points_a = getPointsOnBezierCurves(curvePoints, 1)
      const arrays = lathePoints(points_a, 0, Math.PI * 2, 10, false, false)

      this.buffer_info = new Float32Array([
        ...arrays.position
      ])

      this.idx = new Int16Array([
        ...arrays.indices
      ])

      this.faces = []
      this.vertices = []
  }
}

export default {
  Scene,
  WebGLRenderer,
  PerspectiveCamera,
  AmbientLight,
  TorusGeometry,
  PlaneGeometry,
  BoxGeometry,
  CylinderGeometry,
  LatheGeometry,
  MeshBasicMaterial,
  Mesh
}
