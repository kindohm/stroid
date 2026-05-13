# skills

- always use the "caveman" skill
- always use the "mike style" skill
- always use the "frontend design" skill

# overview

This app is a real time multiplayer game, similar to 
the classic "Asteroids" game. 

one major difference though is that the "map" is much larger than
a single laptop screen. as players move through the map, the 
screen scrolls horizontally and vertically. the user's ship always
remains in the center of the screen. 

the map is "bound" by a horizontal and vertical limit. it is
presented to the user as a thin dotted line over the dark
map background.

let's consider a "ship" to be a single "tile" in size. the
map might be 200x200 tiles. a laptop screen might show only
a 20x20 area, centered on the user's ship.

controls would be from arrow keys:

- "up" thrusts ship
- "right" turns ship right
- "left" turns ship left

the background of the map should be dark. a very subtle 
lined grid should be overlaid, with the grid lines aligning
to a map "tile".

# lobby

when players arrive at the site, they will be taken to a game
lobby. a new game is started when a "start" button is clicked.
players are _required_ to enter a username before being allowed
to join the lobby.


# architecture

- nodejs server, source of truth
- browser clients, using HTML canvas
- all implemented in typescript
