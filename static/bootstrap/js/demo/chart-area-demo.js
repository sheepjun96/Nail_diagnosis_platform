// Set new default font family and font color to mimic Bootstrap's default styling
Chart.defaults.global.defaultFontFamily = 'Nunito', '-apple-system,system-ui,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif';
Chart.defaults.global.defaultFontColor = '#858796';

function number_format(number, decimals, dec_point, thousands_sep) {
  // *     example: number_format(1234.56, 2, ',', ' ');
  // *     return: '1 234,56'
  number = (number + '').replace(',', '').replace(' ', '');
  var n = !isFinite(+number) ? 0 : +number,
    prec = !isFinite(+decimals) ? 0 : Math.abs(decimals),
    sep = (typeof thousands_sep === 'undefined') ? ',' : thousands_sep,
    dec = (typeof dec_point === 'undefined') ? '.' : dec_point,
    s = '',
    toFixedFix = function(n, prec) {
      var k = Math.pow(10, prec);
      return '' + Math.round(n * k) / k;
    };
  // Fix for IE parseFloat(0.55).toFixed(0) = 0;
  s = (prec ? toFixedFix(n, prec) : '' + Math.round(n)).split('.');
  if (s[0].length > 3) {
    s[0] = s[0].replace(/\B(?=(?:\d{3})+(?!\d))/g, sep);
  }
  if ((s[1] || '').length < prec) {
    s[1] = s[1] || '';
    s[1] += new Array(prec - s[1].length + 1).join('0');
  }
  return s.join(dec);
}

var labels=["2025/10/18", "2025/10/20", "2025/10/21"]
var pinger1     = [70.72, 0,  0];
var pinger2      = [67.11,  0, 0];
var pinger3       = [63.08,  44.29,  0];
var pinger4     = [61.38,  61.38,  0];
var pinger5   = [60.00,  0, 0];

// Area Chart Example
var ctx = document.getElementById("myAreaChart");
var myLineChart = new Chart(ctx, {
  type: 'line',
  data: {
    labels: labels,
    datasets: [
      {
        label: "Thumb",
        data: pinger1,
        lineTension: 0.0,
        backgroundColor: "rgba(78, 115, 223, 0.05)",   // primary
        borderColor: "rgba(78, 115, 223, 1)",
        pointRadius: 3,
        pointBackgroundColor: "rgba(78, 115, 223, 1)",
        pointBorderColor: "rgba(78, 115, 223, 1)",
        pointHoverRadius: 3,
        pointHoverBackgroundColor: "rgba(78, 115, 223, 1)",
        pointHoverBorderColor: "rgba(78, 115, 223, 1)",
        pointHitRadius: 10,
        pointBorderWidth: 2,
        fill: true
      },
      {
        label: "Index",
        data: pinger2,
        lineTension: 0.0,
        backgroundColor: "rgba(28, 200, 138, 0.05)",   // success
        borderColor: "rgba(28, 200, 138, 1)",
        pointRadius: 3,
        pointBackgroundColor: "rgba(28, 200, 138, 1)",
        pointBorderColor: "rgba(28, 200, 138, 1)",
        pointHoverRadius: 3,
        pointHoverBackgroundColor: "rgba(28, 200, 138, 1)",
        pointHoverBorderColor: "rgba(28, 200, 138, 1)",
        pointHitRadius: 10,
        pointBorderWidth: 2,
        fill: false
      },
      {
        label: "Middle",
        data: pinger3,
        lineTension: 0.0,
        backgroundColor: "rgba(54, 185, 204, 0.05)",   // info
        borderColor: "rgba(54, 185, 204, 1)",
        pointRadius: 3,
        pointBackgroundColor: "rgba(54, 185, 204, 1)",
        pointBorderColor: "rgba(54, 185, 204, 1)",
        pointHoverRadius: 3,
        pointHoverBackgroundColor: "rgba(54, 185, 204, 1)",
        pointHoverBorderColor: "rgba(54, 185, 204, 1)",
        pointHitRadius: 10,
        pointBorderWidth: 2,
        fill: false
      },
      {
        label: "Ring",
        data: pinger4,
        lineTension: 0.0,
        backgroundColor: "rgba(246, 194, 62, 0.05)",   // warning
        borderColor: "rgba(246, 194, 62, 1)",
        pointRadius: 3,
        pointBackgroundColor: "rgba(246, 194, 62, 1)",
        pointBorderColor: "rgba(246, 194, 62, 1)",
        pointHoverRadius: 3,
        pointHoverBackgroundColor: "rgba(246, 194, 62, 1)",
        pointHoverBorderColor: "rgba(246, 194, 62, 1)",
        pointHitRadius: 10,
        pointBorderWidth: 2,
        fill: false
      },
      {
        label: "Pinky",
        data: pinger5,
        lineTension: 0.0,
        backgroundColor: "rgba(231, 74, 59, 0.05)",    // danger
        borderColor: "rgba(231, 74, 59, 1)",
        pointRadius: 3,
        pointBackgroundColor: "rgba(231, 74, 59, 1)",
        pointBorderColor: "rgba(231, 74, 59, 1)",
        pointHoverRadius: 3,
        pointHoverBackgroundColor: "rgba(231, 74, 59, 1)",
        pointHoverBorderColor: "rgba(231, 74, 59, 1)",
        pointHitRadius: 10,
        pointBorderWidth: 2,
        fill: false
      }
    ],
  },
  options: {
    maintainAspectRatio: false,
    layout: {
      padding: {
        left: 10,
        right: 25,
        top: 25,
        bottom: 0
      }
    },
    scales: {
      xAxes: [{
        time: {
          unit: 'date'
        },
        gridLines: {
          display: false,
          drawBorder: false
        },
        ticks: {
          maxTicksLimit: 7
        }
      }],
      yAxes: [{
        ticks: {
          min:0,
          max : 100,
          stepSize : 20,
          padding: 10,
          // Include a dollar sign in the ticks
          callback: function(value, index, values) {
            return value;
          }
        },
        gridLines: {
          color: "rgb(234, 236, 244)",
          zeroLineColor: "rgb(234, 236, 244)",
          drawBorder: false,
          borderDash: [2],
          zeroLineBorderDash: [2]
        }
      }],
    },
    legend: {
      display: true, position:'bottom'
    },
    tooltips: {
      backgroundColor: "rgb(255,255,255)",
      bodyFontColor: "#858796",
      titleMarginBottom: 10,
      titleFontColor: '#6e707e',
      titleFontSize: 14,
      borderColor: '#dddfeb',
      borderWidth: 1,
      xPadding: 15,
      yPadding: 15,
      displayColors: false,
      intersect: false,
      mode: 'index',
      caretPadding: 10,
      callbacks: {
        label: function(tooltipItem, chart) {
          var datasetLabel = chart.datasets[tooltipItem.datasetIndex].label || '';
          return datasetLabel + ':' + tooltipItem.yLabel;
        }
      }
    }
  }
});

var ctx2 = document.getElementById("myAreaChart2");
var myLineChart2 = new Chart(ctx2, {
  type: 'line',
  data: {
    labels: labels,
    datasets: [
      {
        label: "Thumb",
        data: pinger1,
        lineTension: 0.0,
        backgroundColor: "rgba(78, 115, 223, 0.05)",   // primary
        borderColor: "rgba(78, 115, 223, 1)",
        pointRadius: 3,
        pointBackgroundColor: "rgba(78, 115, 223, 1)",
        pointBorderColor: "rgba(78, 115, 223, 1)",
        pointHoverRadius: 3,
        pointHoverBackgroundColor: "rgba(78, 115, 223, 1)",
        pointHoverBorderColor: "rgba(78, 115, 223, 1)",
        pointHitRadius: 10,
        pointBorderWidth: 2,
        fill: true
      },
      {
        label: "Index",
        data: pinger2,
        lineTension: 0.0,
        backgroundColor: "rgba(28, 200, 138, 0.05)",   // success
        borderColor: "rgba(28, 200, 138, 1)",
        pointRadius: 3,
        pointBackgroundColor: "rgba(28, 200, 138, 1)",
        pointBorderColor: "rgba(28, 200, 138, 1)",
        pointHoverRadius: 3,
        pointHoverBackgroundColor: "rgba(28, 200, 138, 1)",
        pointHoverBorderColor: "rgba(28, 200, 138, 1)",
        pointHitRadius: 10,
        pointBorderWidth: 2,
        fill: false
      },
      {
        label: "Middle",
        data: pinger3,
        lineTension: 0.0,
        backgroundColor: "rgba(54, 185, 204, 0.05)",   // info
        borderColor: "rgba(54, 185, 204, 1)",
        pointRadius: 3,
        pointBackgroundColor: "rgba(54, 185, 204, 1)",
        pointBorderColor: "rgba(54, 185, 204, 1)",
        pointHoverRadius: 3,
        pointHoverBackgroundColor: "rgba(54, 185, 204, 1)",
        pointHoverBorderColor: "rgba(54, 185, 204, 1)",
        pointHitRadius: 10,
        pointBorderWidth: 2,
        fill: false
      },
      {
        label: "Ring",
        data: pinger4,
        lineTension: 0.0,
        backgroundColor: "rgba(246, 194, 62, 0.05)",   // warning
        borderColor: "rgba(246, 194, 62, 1)",
        pointRadius: 3,
        pointBackgroundColor: "rgba(246, 194, 62, 1)",
        pointBorderColor: "rgba(246, 194, 62, 1)",
        pointHoverRadius: 3,
        pointHoverBackgroundColor: "rgba(246, 194, 62, 1)",
        pointHoverBorderColor: "rgba(246, 194, 62, 1)",
        pointHitRadius: 10,
        pointBorderWidth: 2,
        fill: false
      },
      {
        label: "Pinky",
        data: pinger5,
        lineTension: 0.0,
        backgroundColor: "rgba(231, 74, 59, 0.05)",    // danger
        borderColor: "rgba(231, 74, 59, 1)",
        pointRadius: 3,
        pointBackgroundColor: "rgba(231, 74, 59, 1)",
        pointBorderColor: "rgba(231, 74, 59, 1)",
        pointHoverRadius: 3,
        pointHoverBackgroundColor: "rgba(231, 74, 59, 1)",
        pointHoverBorderColor: "rgba(231, 74, 59, 1)",
        pointHitRadius: 10,
        pointBorderWidth: 2,
        fill: false
      }
    ],
  },
  options: {
    maintainAspectRatio: false,
    layout: {
      padding: {
        left: 10,
        right: 25,
        top: 25,
        bottom: 0
      }
    },
    scales: {
      xAxes: [{
        time: {
          unit: 'date'
        },
        gridLines: {
          display: false,
          drawBorder: false
        },
        ticks: {
          maxTicksLimit: 7
        }
      }],
      yAxes: [{
        ticks: {
          min:0,
          max : 100,
          stepSize : 20,
          padding: 10,
          // Include a dollar sign in the ticks
          callback: function(value, index, values) {
            return value;
          }
        },
        gridLines: {
          color: "rgb(234, 236, 244)",
          zeroLineColor: "rgb(234, 236, 244)",
          drawBorder: false,
          borderDash: [2],
          zeroLineBorderDash: [2]
        }
      }],
    },
    legend: {
      display: true, position:'bottom'
    },
    tooltips: {
      backgroundColor: "rgb(255,255,255)",
      bodyFontColor: "#858796",
      titleMarginBottom: 10,
      titleFontColor: '#6e707e',
      titleFontSize: 14,
      borderColor: '#dddfeb',
      borderWidth: 1,
      xPadding: 15,
      yPadding: 15,
      displayColors: false,
      intersect: false,
      mode: 'index',
      caretPadding: 10,
      callbacks: {
        label: function(tooltipItem, chart) {
          var datasetLabel = chart.datasets[tooltipItem.datasetIndex].label || '';
          return datasetLabel + ':' + tooltipItem.yLabel;
        }
      }
    }
  }
});