#version 300 es

precision highp float;

in vec3 in_position;
in vec2 in_texCoord;

out vec2 texCoord;

void main(void) 
{
    texCoord = vec2(in_texCoord.x, 1.0 - in_texCoord.y);
    gl_Position = vec4(in_position, 1.0);
}