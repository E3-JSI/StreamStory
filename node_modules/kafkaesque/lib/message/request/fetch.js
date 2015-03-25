/*
 * THIS SOFTWARE IS PROVIDED ``AS IS'' AND ANY EXPRESSED OR IMPLIED
 * WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES
 * OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED.  IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY DIRECT,
 * INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
 * SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION)
 * HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT,
 * STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING
 * IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 * POSSIBILITY OF SUCH DAMAGE.
 */

'use strict';

var common = require('./common');



var maxWait = function(timeInMs) {
  this.buf.appendUInt32BE(0xffffffff);  // replica id
  this.buf.appendUInt32BE(timeInMs);
  return this;
};



var minBytes = function(bytes) {
  this.buf.appendUInt32BE(bytes);
  return this;
};



var offset = function(offsetLow, offsetHigh) {
  this.buf.appendUInt32BE(offsetHigh);
  this.buf.appendUInt32BE(offsetLow);
  return this;
};



var maxBytes = function(bytes) {
  this.buf.appendUInt32BE(bytes);
  return this;
};



exports.encode = function() {
  var ret = common.encode(common.FETCH_API);

  ret.maxWait = maxWait;
  ret.minBytes = minBytes;
  ret.offset = offset;
  ret.maxBytes = maxBytes;
  return ret;
};


