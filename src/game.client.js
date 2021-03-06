let bind_game_stuff = (socket) => {
  let me, mothership, cursor_location, selected = {};
  let selection_groups = {};
  let arena;
  let view_center = [0, 0];
  let moi = () => arena.users[me];
  let pressed_keys = {};
  let ui_state = { mode: 'NONE' };
  let cost_display = el('cost');
  let capacity_display = el('cap');
  let canvas = el('c');
  let ctx = canvas.getContext('2d');
  let add_event_listener = (object, ...args) => object.addEventListener(...args);
  let w = window;
  let picker, selecteder;
  let presets;

  let game_to_screen = (game_pos, view_center_) => {
    let vc = view_center_ || view_center
    let screen_dimensions = [ctx.canvas.width, ctx.canvas.height];
    let center = scale(screen_dimensions, 0.5);
    let dist_from_center = sub(game_pos, vc);
    let screen_coordinate = add(center, dist_from_center);
    return screen_coordinate;
  };


  let screen_to_game = (screen_pos, view_center_) => {
    let vc = view_center_ || view_center
    let screen_dimensions = [ctx.canvas.width, ctx.canvas.height];
    let center = scale(screen_dimensions, 0.5);
    return add(sub(screen_pos, center), vc);
  };


  {
    let old_destroy = Unit.prototype.destroy;
    Unit.prototype.destroy = function(user_was_removed) {
      old_destroy.call(this);
      if (this.owner.id === me) {
        for (let group of selection_groups.values()) {
          delete group[this.id];
        }
        delete selected[this.id];
      }
      if (!user_was_removed && arena.users.values().length != 1) {
        if (moi().units.values().length === 0) {
          el('q').style.backgroundColor = '#781A05';
        } else if (arena.units.values().filter((unit) => unit.owner.id != me).length === 0) {
          el('q').style.backgroundColor = '#078219';
        }
      }
    }
  }

  CanvasRenderingContext2D.prototype.circle = function(pos, radius) {
    this.arc(...pos, radius, 0, Math.PI * 2);
  }

  let scale_path = (rate, ...path) => path.map(([x, y]) => [rate * x, rate * y]);

  let ship_shapes = [
    (unit) => [{
      body: {
        fillStyle: unit.owner.color,
        strokeStyle: unit.health_color(),
        lineWidth: 3,
        paths: [scale_path(unit.radius(), [0, -1], [1, 1], [-1, 1])]
      },
      flames: {
        fillStyle: 'orange',
        paths: [
          ((r, s) => [[0, r + s], [r / 2, r], [-r / 2, r]])(unit.radius(),
            leng(unit.current_acceleration || [0,0]) * 7)
        ]
      },
      selected: {
        paths: selected[unit.id] ? [scale_path(unit.radius() * 1.8, [0, -1], [1, 0.8], [-1, 0.8])] : [],
        strokeStyle: 'orange',
        lineWidth: 1
      }
    }],
    (unit) => [{
      body: {
        fillStyle: unit.owner.color,
        strokeStyle: unit.health_color(),
        lineWidth: 3,
        paths: [scale_path(unit.radius(), [0, -1], [1, 1], [-1, 1])]
      },
      flames: {
        fillStyle: '#FF8400',
        strokeStyle: '#FFC400',
        lineWidth: 3,
        paths: ((r, s) => [
          [[3, r], [3 + r / 2, r + s], [r - 3, r]],
          [[-3, r], [-r / 2 - 3, r + s], [-r + 3, r]]
        ])(unit.radius(), leng(unit.current_acceleration || [0,0]) * 7)
      },
      selected: {
        paths: selected[unit.id] ? [scale_path(unit.radius() * 1.8, [0, -1], [1, 0.8], [-1, 0.8])] : [],
        strokeStyle: 'orange',
        lineWidth: 1
      }
    }]
  ]

  // Draw base of ship, below any lasers
  Unit.prototype.draw_lower = function() {
    let ship_shape = ship_shapes[this.shape_id](this)[0];
    ['flames', 'body', 'selected'].forEach((component) => {
      let info = ship_shape[component];
      // Exit early if no info for component
      if (!info) return;
      ctx.beginPath();
      info.paths.forEach((path) => {
        ctx.moveTo(...path.shift());
        path.forEach((pos) => ctx.lineTo(...pos));
        ctx.closePath();
      })
      ctx.fillStyle = this.activated ? info.fillStyle : 'rgba(128, 128, 128, 0.5)';
      ctx.strokeStyle = this.activated ? info.strokeStyle : 'rgba(128, 128, 128, 0.5)';
      ctx.lineWidth = info.lineWidth;
      if (info.fillStyle) ctx.fill();
      if (info.strokeStyle) ctx.stroke();
    })
  }

  // Stuff that is above the lasers
  Unit.prototype.draw_upper = function() {
    ctx.beginPath();
    ctx.circle([0,0], 5);
    ctx.closePath();
    ctx.fillStyle = 'grey';
    ctx.fill();
  }

  Unit.prototype.draw = function() {
    let size = this.radius();
    let pos = game_to_screen(this.pos);
    ctx.save();
    ctx.translate(...pos);
    ctx.rotate(this.rotation);
    this.draw_lower();
    let other;
    if (this.command) {
      ctx.restore();
      if (this.laser) {
        let target;
        switch (this.command.type) {
          case 'attack':
            target = this.arena.units[this.command.target_id];
            ctx.lineWidth = 2;
            ctx.strokeStyle = '#CF4800';
            break;
          case 'mine':
            target = this.arena.asteroid_field.asteroid(...this.command.target_id);
            ctx.lineWidth = 4;
            ctx.strokeStyle = '#0087CF';
            break;
          case 'transfer':
          case 'construct':
            target = this.arena.units[this.command.target_id];
            ctx.lineWidth = 3;
            ctx.strokeStyle = '#20CF00';
            break;
        }
        if (target) {
          ctx.beginPath();
          ctx.lineWidth = 2;
          ctx.moveTo(...pos);
          ctx.lineTo(...game_to_screen(target.pos));
          ctx.stroke();
        }
      }
      // move back
      ctx.save();
      ctx.translate(...pos);
      ctx.rotate(this.rotation);
    }
    if (this.activated) this.draw_upper();
    ctx.restore();
  }

  Asteroid.prototype.draw = function() {
    ctx.beginPath();
    ctx.save();
    //ctx.translate(...game_to_screen(this.position));
    //ctx.rotate(this.rotation);
    ctx.moveTo(...game_to_screen(this.shape()[0]));
    this.shape().forEach((pos) => ctx.lineTo(...game_to_screen(pos)))
    ctx.closePath();
    let shade = Math.floor(this.stats / 20);
    let inverse = 255 - shade;
    ctx.fillStyle = 'rgb(' + [shade, shade, shade] + ')';
    ctx.strokeStyle = 'rgb(' + [inverse, inverse, inverse] + ')';
    ctx.lineWidth = 3;
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  let draw_stars = (e, s, min, max) => {
    let star_canvas = el(e);
    let star_ctx = star_canvas.getContext('2d');

    let master = new RNG(15784 + s + min + max);
    let x_coefficient = master.random_int();
    let y_coefficient = master.random_int();
    let constant = master.random_int();
    const block_size = 200;

    let previous_view_center = null;

    let resize = () => {
      star_canvas.width = window.innerWidth;
      star_canvas.height = window.innerHeight;
      previous_view_center = null;
    }
    add_event_listener(w, 'resize', resize);
    resize();

    let round_to = (type, block) => ((x) => type(x / block) * block);
    let round_to_floor = round_to(Math.floor, block_size);
    let round_to_ceil = round_to(Math.ceil, block_size);

    return () => {
      if(previous_view_center + '' !== view_center + '') {
        star_ctx.clearRect(0, 0, star_canvas.width, star_canvas.height);
        let star_center = scale(view_center, s);
        for (let x = round_to_floor(star_center[0] - star_canvas.width / 2); x < round_to_ceil(star_center[0] + star_canvas.width / 2); x += block_size) {
          for (let y = round_to_floor(star_center[1] - star_canvas.height / 2); y < round_to_ceil(star_center[1] + star_canvas.height / 2); y += block_size) {

            let rng = new RNG(x_coefficient*x/block_size + y_coefficient*y/block_size + constant);
            let num_stars = Math.round(mix(rng.random(), min, max));
            while(num_stars--) {
              let radius = 1+rng.random()*0.5;
              let pos = game_to_screen([x + rng.random()*block_size, y + rng.random()*block_size], star_center);
              star_ctx.beginPath();
              star_ctx.circle(pos, radius);
              star_ctx.fillStyle = 'white';
              star_ctx.fill();
            }
          }
        }
      }
      previous_view_center = view_center;
    }
  }

  let draw_near_stars = draw_stars('near_stars', 0.15, 2, 5);
  let draw_min_stars = draw_stars('mid_stars', 0.10, 3, 7);
  let draw_far_stars = draw_stars('far_stars', 0.05, 2, 5);

  let resize = () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  };
  add_event_listener(w, "resize", resize);
  resize();

  let previous_time = null;
  let draw = (time) => {
    if(previous_time) {
      let dt = time - previous_time;
      let scroll_dir = [0, 0];
      const arrows = [['a', [-1, 0]], ['d', [1, 0]], ['w', [0, -1]], ['s', [0, 1]]];
      arrows.forEach(([name, dir]) => {
        if (pressed_keys[name]) scroll_dir = add(scroll_dir, dir);
      });
      view_center = add(view_center, scale(norm(scroll_dir), dt));
    }
    previous_time = time;
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    draw_near_stars();
    draw_min_stars();
    draw_far_stars();
    ctx.strokeStyle = 'white';
    if(ui_state.mode === 'SELECT') {
      ctx.strokeRect(...ui_state.origin, ...sub(cursor_location, ui_state.origin));
    }
    if (arena) {
      arena.units.values().forEach((unit) => unit.draw());
      arena.asteroid_field
        .in_range(view_center[1] - canvas.height, view_center[0] - canvas.width, view_center[1] + canvas.height, view_center[0] + canvas.width)
        .values()
        .forEach((asteroid) => asteroid.draw());
      arena.users.values().forEach((user) => {
        let d = sub(user.centroid(), view_center);
        if(Math.abs(d[0]) > canvas.width/2 || Math.abs(d[1]) > canvas.height/2) {
          ctx.beginPath();
          ctx.moveTo(...add(scale(d, (canvas.height/2)/Math.abs(d[1])), [canvas.width/2-25, canvas.height/2]));
          ctx.lineTo(...add(scale(d, (canvas.height/2)/Math.abs(d[1])), [canvas.width/2+25, canvas.height/2]));
          ctx.strokeStyle = user.color;
          ctx.lineWidth = 10;
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(...add(scale(d, (canvas.width/2)/Math.abs(d[0])), [canvas.width/2, canvas.height/2-25]));
          ctx.lineTo(...add(scale(d, (canvas.width/2)/Math.abs(d[0])), [canvas.width/2, canvas.height/2+25]));
          ctx.strokeStyle = user.color;
          ctx.lineWidth = 10;
          ctx.stroke();
          ctx.beginPath();
        }
      });

      if (ui_state.mode === 'CREATE') {
        Object.setPrototypeOf({ owner: { color: 'rgba(255, 255, 255, 0.5)' }, rotation: Math.PI/2, pos: screen_to_game(cursor_location), radius: () => 15, shape_id: 1 }, Unit.prototype).draw();
      }
      selecteder.update(selected);
      let capacity = (selected.values() || []).map((unit) => unit.hold).reduce(nums.add, 0);
      capacity_display.innerText = Math.floor(capacity);
    }
    window.requestAnimationFrame(draw);
  }

  function handle_tick(commands) {
    for (var command of commands) {
      arena.receive(command);
    }
    if (arena) arena.tick();
  }

  let command = (...args) => socket.emit('command', ['command_unit', ...args])
  let make_baby = (...args) => socket.emit('command', ['make_baby', ...args])
  socket.on('tick', handle_tick);

  let create_button = el('create');
  create_button.onclick = () => {
    // enter create mode
    ui_state = { mode: 'CREATE' };
  };


  add_event_listener(w, 'contextmenu', (event) => event.preventDefault());
  add_event_listener(canvas, 'mousedown', (event) => cursor_location = [event.x, event.y]);
  add_event_listener(canvas, 'mousemove', (event) => cursor_location = [event.x, event.y]);
  add_event_listener(canvas, 'mouseup', (event) => cursor_location = [event.x, event.y]);

  add_event_listener(canvas, 'mousedown', (event) => {
    if ((event.button === 0 && pressed_keys['p']) || event.button === 1) {
      ui_state = { mode: 'PAN', origin: cursor_location, original_view_center: view_center };
    } else if (event.button === 0 && ui_state.mode === 'NONE') {
      ui_state = { mode: 'SELECT', origin: cursor_location, additive: pressed_keys['shift'] };
    }
  });

  add_event_listener(canvas, 'mousemove', (event) => {
    if (ui_state.mode === 'PAN') {
      view_center = add(ui_state.original_view_center, sub(ui_state.origin, cursor_location));
    }
  });

  add_event_listener(canvas, 'mouseup', (event) => {
    let game_cursor = screen_to_game(cursor_location);
    if (ui_state.mode === 'SELECT') {
      if (!ui_state.additive) selected = {};
      // Take all of our units
      (moi() ? moi().units.values() : [])
        // Filter to just the ones in the rounded rectangle specified by the cursor location and selection origin
        .filter((unit) => in_rounded_rectangle(unit.pos, unit.radius(), screen_to_game(cursor_location), screen_to_game(ui_state.origin)))
        // Put each of these units into the selected set
        .forEach((unit) => selected[unit.id] = unit);
      ui_state = { mode: 'NONE' };
    } else if (ui_state.mode === 'PAN') {
      ui_state = { mode: 'NONE' };
    } else if (ui_state.mode === 'CREATE') {
      make_baby(screen_to_game(cursor_location), picker.get_value());
    } else if (event.button === 2) {
      let offset = [0, 0];
      let target_id;
      let target_type = 'unit';
      let target = arena.units.values()
        .find((unit) =>
          in_rounded_rectangle(unit.pos, unit.radius(), game_cursor)
        );
      if (target) {
        target_id = target.id;
      } else {
        target_type = 'asteroid';
        
        target = arena.asteroid_field.in_range(
          view_center[1] - canvas.height/2,
          view_center[0] - canvas.width/2,
          view_center[1] + canvas.height/2,
          view_center[0] + canvas.width/2).values().find((ast) => ast.point_in(game_cursor));
        if (target) {
          target_id = target.get_index();
        }
      }
      let move, construct, attack, transfer, mine;
      move = (unit, target, range) => {
        if(!unit || !target) return;
        command(unit.id, 'set_command', { type: 'move', dest: add(target.pos, scale(norm(sub(unit.pos, target.pos)), 0.95*range)) });
        unit.events.done = () => {
          command(unit.id, 'set_command', null);
        }
      };
      construct = (unit, target) => {
        command(unit.id, 'set_command', { type: 'construct', target_id: target });
        unit.events.out_of_range = () => {
          move(unit, arena.units[target], unit.stats.construct.range);
          unit.events.done = () => construct(unit, target);
        }
        unit.events.done = () => transfer(unit, target);
      };
      transfer = (unit, target) => {
        command(unit.id, 'set_command', { type: 'transfer', target_id: target });
        unit.events.out_of_range = () => {
          move(unit, arena.units[target], unit.stats.misc['transfer range']);
          unit.events.done = () => transfer(unit, target);
        }
        unit.events.done = () => command(unit.id, 'set_command', null);
      };
      attack = (unit, target) => {
        command(unit.id, 'set_command', { type: 'attack', target_id: target });
        unit.events.out_of_range = () => {
          move(unit, arena.units[target], unit.stats.attack.range);
          unit.events.done = () => attack(unit, target);
        }
        unit.events.done = () => command(unit.id, 'set_command', null);
      };
      mine = (unit, target) => {
        command(unit.id, 'set_command', { type: 'mine', target_id: target });
        unit.events.out_of_range = () => {
          move(unit, arena.asteroid_field.asteroid(...target), unit.stats.mine.range);
          unit.events.done = () => mine(unit, target);
        }
        unit.events.done = () => command(unit.id, 'set_command', null);
      };


      selected.values()
        .forEach((unit) => {
          if (target) {
            if (target_type == 'unit' && target.owner.id == me) {
              construct(unit, target_id);
              /*command(unit.id, 'set_command', { type: 'construct', target_id: target_id });
              unit.events.out_of_range = () => {
                command(unit.id, 'set_command', { type: 'move', dest: add(target.pos, scale(norm(sub(unit.pos, target.pos)), 0.95*unit.stats.construct.range)) });
                unit.events.done = () => {
                  command(unit.id, 'set_command', { type: 'construct', target_id: target_id });
                };
              };
              unit.events.done = () => {
                command(unit.id, 'set_command', { type: 'transfer', target_id: target_id });
              };*/
            } else {
              if (target_type == 'unit') {
                attack(unit, target_id);
                /*command(unit.id, 'set_command', { type: 'attack', target_id: target_id });
                //unit.events.hold_full.register(() => {
                  //alert('hold full');
                //});
                unit.events.out_of_range = () => {
                  command(unit.id, 'set_command', { type: 'move', dest: add(target.pos, scale(norm(sub(unit.pos, target.pos)), 0.95*unit.stats.attack.range)) });
                  unit.events.done = () => {
                    command(unit.id, 'set_command', { type: 'attack', target_id: target_id });
                  };
                };*/
              } else if (target_type == 'asteroid') {
                mine(unit, target_id);
                /*command(unit.id, 'set_command', { type: 'mine', target_id: target_id });
                unit.events.out_of_range = () => {
                  command(unit.id, 'set_command', { type: 'move', dest: add(target.pos, scale(norm(sub(unit.pos, target.pos)), 0.95*unit.stats.mine.range)) });
                  unit.events.done = () => {
                    command(unit.id, 'set_command', { type: 'mine', target_id: target_id });
                  };
                };*/
              }
            }
          } else {
            move(unit, { pos: add(screen_to_game(cursor_location), offset) }, 0);
            /*command(unit.id, 'set_command', { type: 'move', dest: add(screen_to_game(cursor_location), offset) });
            unit.events.done = () => {};*/
            offset = add(offset, [36, 0]);
          }
        });
    }
  });

  let shortcut_map = {
    e: () => selected = Object.assign({}, arena.users[me].units),
    q: () => selected = {},
    c: create_button.onclick,
    // TODO: reimplement deletion
    " ": () =>  { if (selected.values()[0]) view_center = selected.values()[0].pos; },
    Escape: (event) => {
      event.preventDefault();
      ui_state = { mode: 'NONE' };
    }
  };

  let keys_done = false;
  let init_key_listeners = () => {
    if (keys_done) return;
    keys_done = true;
    add_event_listener(w, 'keydown', (event) => {
      pressed_keys[event.key] = event;
      let shortcut_description = '';
      if (event.ctrlKey) {
        shortcut_description += 'C-';
        pressed_keys['ctrl'] = event;
      }
      if (event.altKey) {
        shortcut_description += 'M-';
        pressed_keys['alt'] = event;
      }
      if (event.shiftKey) {
        shortcut_description += 'S-';
        pressed_keys['shift'] = event;
      }

      if(/^\d$/.test(event.key)) {
        if (event.ctrlKey) {
          selection_groups[event.key] = Object.assign({}, selected);
        } else {
          selected = Object.assign({}, selection_groups[event.key] || {});
        }
      } else {
        shortcut_description += event.key;
        if (shortcut_map[shortcut_description]) shortcut_map[shortcut_description](event);
      }
    });

    add_event_listener(w, 'keyup', (event) => {
      delete pressed_keys[event.key];
      if (!event.shiftKey) delete pressed_keys['shift'];
      if (!event.ctrlKey) delete pressed_keys['ctrl'];
      if (!event.altKey) delete pressed_keys['alt'];
    });
  }

  socket.on('create_arena', (arena_, me_) => {
    init_key_listeners();
    el('room').style.display = 'none';
    el('game').style.display = 'block';
    let attrs = [ { short: 'Rn', title: 'Range' }, { short: 'Pw', title: 'Power' },
      { short: 'Ef', title: 'Efficiency' } ]; 
    let picker_vals = [
      { name: 'attack', stats: ['range', 'power', 'efficiency'] },
      { name: 'mine', stats: ['range', 'power', 'efficiency'] },
      { name: 'construct', stats: ['range', 'power', 'efficiency'] },
      { name: 'misc', stats: ['acceleration', 'capacity', 'defence', 'transfer range'] }
    ];
    picker = make_picker(picker_vals);
    el('pcks').appendChild(picker.element);
    selecteder = create_selected_stats(el('selected'), picker_vals);
    picker.onchange = (value) => {
      console.log(value);
      cost_display.innerText = new Stats(value).cost.num_pretty();
    };
    picker.set_value({
      attack: { range: 0.5, power: 0.5, efficiency: 0.5 },
      mine: { range: 0.5, power: 0.5, efficiency: 0.5 },
      construct: { range: 0.5, power: 0.5, efficiency: 0.5 },
      misc: { acceleration: 0.5, capacity: 0.5, defence: 0.5, 'transfer range': 0.5 }
    });
    picker.add_preset({ name: 'fighter', stats: {
      attack: { range: 0.95, power: 0.95, efficiency: 0.2 },
      mine: { range: 0, power: 0, efficiency: 0 },
      construct: { range: 0, power: 0, efficiency: 0 },
      misc: { acceleration: 0.8, capacity: 0, defence: 0.7, 'transfer range': 0.5 }
    }});
    picker.add_preset({ name: 'miner', stats: {
      attack: { range: 0, power: 0, efficiency: 0 },
      mine: { range: 0.95, power: 0.95, efficiency: 0.95 },
      construct: { range: 0, power: 0, efficiency: 0 },
      misc: { acceleration: 0.2, capacity: 0.4, defence: 0, 'transfer range': 0.5 }
    }});
    picker.add_preset({ name: 'builder', stats: {
      attack: { range: 0, power: 0, efficiency: 0 },
      mine: { range: 0, power: 0, efficiency: 0 },
      construct: { range: 0.95, power: 0.95, efficiency: 0.95 },
      misc: { acceleration: 0.2, capacity: 0.4, defence: 0, 'transfer range': 0.5 }
    }});
    picker.add_preset({ name: 'tanker', stats: {
      attack: { range: 0, power: 0, efficiency: 0 },
      mine: { range: 0, power: 0, efficiency: 0 },
      construct: { range: 0, power: 0, efficiency: 0 },
      misc: { acceleration: 0.2, capacity: 0.95, defence: 0, 'transfer range': 0.5 }
    }});
    console.log(arena_);
    arena = new Arena(arena_);
    me = me_;
    view_center = moi().centroid();
    console.log('connected', arena, me);
    window.requestAnimationFrame(draw);
  });

  socket.on("error", () => {
    console.log("error")
  });
};
